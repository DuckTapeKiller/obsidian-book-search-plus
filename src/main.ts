import {
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  requestUrl,
  Menu,
} from "obsidian";
import { factoryServiceProvider } from "@apis/base_api";
import { CalibreApi } from "@apis/calibre_api";

import { BookSearchModal } from "@views/book_search_modal";
import { BookSuggestModal } from "@views/book_suggest_modal";
import { ServiceSelectionModal } from "@views/service_selection_modal";
import { CalibreMultiSelectModal } from "@views/calibre_multi_select_modal";
import { CalibreBrowseModal } from "@views/calibre_browse_modal";
import {
  DuplicateCheckModal,
  DuplicateAction,
  findExistingBookNote,
} from "@views/duplicate_check_modal";
import { CursorJumper } from "@utils/cursor_jumper";
import { Book } from "@models/book.model";
import {
  BookSearchSettingTab,
  BookSearchPluginSettings,
  DEFAULT_SETTINGS,
} from "@settings/settings";
import {
  getTemplateContents,
  applyTemplateTransformations,
  useTemplaterPluginInFile,
  executeInlineScriptsTemplates,
} from "@utils/template";
import {
  replaceVariableSyntax,
  makeFileName,
  applyDefaultFrontMatter,
  toStringFrontMatter,
  createBookTags,
} from "@utils/utils";

export default class BookSearchPlugin extends Plugin {
  settings: BookSearchPluginSettings;

  onload() {
    void this.loadSettings().then(() => {
      // This creates an icon in the left ribbon.
      const ribbonIconEl = this.addRibbonIcon(
        "book",
        "Create new book note",
        (evt) => this.selectServiceAndSearch(evt),
      );
      ribbonIconEl.addClass("obsidian-book-search-plugin-ribbon-class");

      // ===== Core Commands =====
      this.addCommand({
        id: "open-book-search-modal",
        name: "Create new book note",
        callback: () => {
          void this.createNewBookNote().catch((err) => console.warn(err));
        },
      });

      this.addCommand({
        id: "open-book-search-modal-to-insert",
        name: "Insert the metadata",
        callback: () => {
          void this.insertMetadata().catch((err) => console.warn(err));
        },
      });

      // ===== Service-Specific Commands =====
      this.addCommand({
        id: "search-google-books",
        name: "Search Google Books",
        callback: () => {
          void this.createNewBookNote("google").catch((err) => console.warn(err));
        },
      });

      this.addCommand({
        id: "search-goodreads",
        name: "Search Goodreads",
        callback: () => {
          void this.createNewBookNote("goodreads").catch((err) => console.warn(err));
        },
      });

      this.addCommand({
        id: "search-calibre",
        name: "Search Calibre (Multi-Select)",
        callback: () => {
          void this.createMultipleCalibreNotes().catch((err) => console.warn(err));
        },
      });

      this.addCommand({
        id: "search-openlibrary",
        name: "Search OpenLibrary",
        callback: () => {
          void this.createNewBookNote("openlibrary").catch((err) => console.warn(err));
        },
      });

      this.addCommand({
        id: "browse-calibre",
        name: "Browse Calibre Library",
        callback: () => {
          void this.browseCalibreLibrary().catch((err) => console.warn(err));
        },
      });

      // ===== Utility Commands =====
      this.addCommand({
        id: "clear-search-history",
        name: "Clear search history",
        callback: () => {
          this.clearSearchHistory();
          new Notice("Search history cleared");
        },
      });

      // This adds a settings tab
      this.addSettingTab(new BookSearchSettingTab(this.app, this));

      console.debug(
        `Book Search: version ${this.manifest.version} (requires obsidian ${this.manifest.minAppVersion})`,
      );
    });
  }

  showNotice(message: unknown) {
    try {
      const notice =
        message instanceof Error
          ? message.message
          : typeof message === "string"
            ? message
            : JSON.stringify(message) || "Unknown error";
      new Notice(notice);
    } catch {
      // eslint-disable
    }
  }

  // ========================================
  // Search History Management
  // ========================================

  addToSearchHistory(query: string): void {
    if (!query.trim()) return;

    const history = this.settings.searchHistory || [];
    // Remove if already exists (to move to top)
    const filtered = history.filter((h) => h !== query);
    // Add to beginning
    filtered.unshift(query);
    // Limit size
    this.settings.searchHistory = filtered.slice(0, this.settings.maxSearchHistory || 10);
    void this.saveSettings();
  }

  getSearchHistory(): string[] {
    return this.settings.searchHistory || [];
  }

  clearSearchHistory(): void {
    this.settings.searchHistory = [];
    void this.saveSettings();
  }

  // ========================================
  // Duplicate Detection
  // ========================================

  async checkForDuplicate(book: Book): Promise<DuplicateAction> {
    if (!this.settings.warnOnDuplicate) {
      return DuplicateAction.CREATE_ANYWAY;
    }

    const existingFile = findExistingBookNote(
      this.app,
      this.settings.folder,
      book.title,
      book.isbn13 || book.isbn10 || book.ids,
    );

    if (existingFile) {
      const modal = new DuplicateCheckModal(this.app, existingFile, book.title);
      return await modal.waitForChoice();
    }

    return DuplicateAction.CREATE_ANYWAY;
  }

  // ========================================
  // Core Book Search Functions
  // ========================================

  async searchBookMetadata(query?: string): Promise<Book> {
    const searchedBooks = await this.openBookSearchModal(query);
    const book = await this.openBookSuggestModal(searchedBooks);

    // Enrich book with full details if provider supports it
    const api = factoryServiceProvider(
      this.settings,
      this.serviceProviderOverride,
    );

    if (api.getBook) {
      return await api.getBook(book);
    }
    return book;
  }

  async getRenderedContents(book: Book) {
    const {
      templateFile,
      useDefaultFrontmatter,
      defaultFrontmatterKeyType,
      enableCoverImageSave,
      coverImagePath,
      frontmatter,
      content,
    } = this.settings;

    // Generate tags automatically as requested
    book.tags = createBookTags(book);

    let contentBody = "";

    if (enableCoverImageSave) {
      const coverImageUrl =
        book.coverLargeUrl ||
        book.coverMediumUrl ||
        book.coverSmallUrl ||
        book.coverUrl;
      if (coverImageUrl) {
        const imageName = `${book.title} — ${book.author}.jpg`.replace(
          /[:/\\?%*|"<>]/g,
          "",
        );
        book.localCoverImage = await this.downloadAndSaveImage(
          imageName,
          coverImagePath,
          coverImageUrl,
        );
      }
    }

    if (templateFile) {
      const templateContents = await getTemplateContents(
        this.app,
        templateFile,
      );
      const replacedVariable = replaceVariableSyntax(
        book,
        applyTemplateTransformations(templateContents),
      );
      contentBody += executeInlineScriptsTemplates(book, replacedVariable);
    } else {
      let replacedVariableFrontmatter = replaceVariableSyntax(
        book,
        frontmatter,
      );
      if (useDefaultFrontmatter) {
        replacedVariableFrontmatter = toStringFrontMatter(
          applyDefaultFrontMatter(
            book,
            replacedVariableFrontmatter,
            defaultFrontmatterKeyType,
          ),
        );
      }
      const replacedVariableContent = replaceVariableSyntax(book, content);
      contentBody += replacedVariableFrontmatter
        ? `---\n${replacedVariableFrontmatter}\n---\n${replacedVariableContent}`
        : replacedVariableContent;
    }

    return contentBody;
  }

  async downloadAndSaveImage(
    imageName: string,
    directory: string,
    imageUrl: string,
  ): Promise<string> {
    const { enableCoverImageSave } = this.settings;
    if (!enableCoverImageSave) {
      console.warn("Cover image saving is not enabled.");
      return "";
    }

    try {
      const response = await requestUrl({
        url: imageUrl,
        method: "GET",
        headers: {
          Accept: "image/*",
        },
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const imageData = response.arrayBuffer;
      const filePath = `${directory}/${imageName}`;
      await this.app.vault.adapter.writeBinary(filePath, imageData);
      // Return as wiki link format for clickable frontmatter
      return `[[${filePath}]]`;
    } catch (error) {
      console.error("Error downloading or saving image:", error);
      return "";
    }
  }

  async insertMetadata(): Promise<void> {
    try {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!markdownView) {
        console.warn("Can not find an active markdown view");
        return;
      }

      const book = await this.searchBookMetadata(markdownView.file.basename);

      if (!markdownView.editor) {
        console.warn("Can not find editor from the active markdown view");
        return;
      }

      const renderedContents = await this.getRenderedContents(book);
      markdownView.editor.replaceRange(renderedContents, { line: 0, ch: 0 });
    } catch (err) {
      console.warn(err);
      this.showNotice(err);
    }
  }

  serviceProviderOverride?: string;

  async createNewBookNote(serviceProvider?: string): Promise<void> {
    try {
      this.serviceProviderOverride = serviceProvider;
      const book = await this.searchBookMetadata();

      // Check for duplicate
      const action = await this.checkForDuplicate(book);

      if (action === DuplicateAction.CANCEL) {
        return;
      }

      if (action === DuplicateAction.OPEN_EXISTING) {
        const existingFile = findExistingBookNote(
          this.app,
          this.settings.folder,
          book.title,
          book.isbn13 || book.isbn10,
        );
        if (existingFile) {
          await this.openNewBookNote(existingFile);
        }
        return;
      }

      const targetFile = await this.createNoteForBook(book);
      await this.openNewBookNote(targetFile);
    } catch (err) {
      if (err.message !== "Cancelled request") {
        console.warn(err);
        this.showNotice(err);
      }
    }
  }

  /**
   * Create a note for a single book (extracted for reuse in multi-import)
   */
  async createNoteForBook(book: Book): Promise<TFile> {
    const renderedContents = await this.getRenderedContents(book);
    const fileName = makeFileName(book, this.settings.fileNameFormat);
    const filePath = `${this.settings.folder}/${fileName}`;
    const targetFile = await this.app.vault.create(filePath, renderedContents);
    await useTemplaterPluginInFile(this.app, targetFile);
    return targetFile;
  }

  /**
   * Import multiple books from Calibre at once
   */
  async createMultipleCalibreNotes(): Promise<void> {
    try {
      this.serviceProviderOverride = "calibre";

      // Search for books
      const searchedBooks = await this.openBookSearchModal();

      // Open multi-select modal
      const selectedBooks = await this.openCalibreMultiSelectModal(searchedBooks);

      if (selectedBooks.length === 0) {
        return;
      }

      // Enrich selected books with full details
      const api = factoryServiceProvider(this.settings, this.serviceProviderOverride);
      const enrichedBooks: Book[] = [];

      for (const book of selectedBooks) {
        if (api.getBook) {
          enrichedBooks.push(await api.getBook(book));
        } else {
          enrichedBooks.push(book);
        }
      }

      // Create notes for all selected books (with duplicate check)
      let successCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const book of enrichedBooks) {
        try {
          // Check for duplicate (skip modal for batch, just skip duplicates)
          if (this.settings.warnOnDuplicate) {
            const existingFile = findExistingBookNote(
              this.app,
              this.settings.folder,
              book.title,
              book.isbn13 || book.isbn10 || book.ids,
            );
            if (existingFile) {
              skippedCount++;
              continue;
            }
          }

          await this.createNoteForBook(book);
          successCount++;
        } catch (err) {
          console.warn(`Failed to create note for ${book.title}`, err);
          errors.push(book.title);
        }
      }

      // Show summary
      let message = `Created ${successCount} book note${successCount !== 1 ? "s" : ""}`;
      if (skippedCount > 0) {
        message += `, skipped ${skippedCount} duplicate${skippedCount !== 1 ? "s" : ""}`;
      }
      if (errors.length > 0) {
        message += `. Failed: ${errors.join(", ")}`;
      }
      new Notice(message);

    } catch (err) {
      if (err.message !== "Cancelled request") {
        console.warn(err);
        this.showNotice(err);
      }
    }
  }

  /**
   * Browse Calibre library by tags, series, or authors
   */
  async browseCalibreLibrary(): Promise<void> {
    try {
      const calibreApi = new CalibreApi(
        this.settings.calibreServerUrl,
        this.settings.calibreLibraryId,
      );

      const selectedBooks = await new Promise<Book[]>((resolve, reject) => {
        new CalibreBrowseModal(
          this.app,
          calibreApi,
          this.settings.showCoverImageInSearch,
          (error, books) => {
            if (error) {
              reject(error);
            } else {
              resolve(books || []);
            }
          },
        ).open();
      });

      if (selectedBooks.length === 0) {
        return;
      }

      // Create notes for all selected books
      let successCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const book of selectedBooks) {
        try {
          if (this.settings.warnOnDuplicate) {
            const existingFile = findExistingBookNote(
              this.app,
              this.settings.folder,
              book.title,
              book.isbn13 || book.isbn10 || book.ids,
            );
            if (existingFile) {
              skippedCount++;
              continue;
            }
          }

          await this.createNoteForBook(book);
          successCount++;
        } catch (err) {
          console.warn(`Failed to create note for ${book.title}`, err);
          errors.push(book.title);
        }
      }

      let message = `Created ${successCount} book note${successCount !== 1 ? "s" : ""}`;
      if (skippedCount > 0) {
        message += `, skipped ${skippedCount} duplicate${skippedCount !== 1 ? "s" : ""}`;
      }
      if (errors.length > 0) {
        message += `. Failed: ${errors.join(", ")}`;
      }
      new Notice(message);

    } catch (err) {
      if (err.message !== "Cancelled request") {
        console.warn(err);
        this.showNotice(err);
      }
    }
  }

  /**
   * Open multi-select modal for Calibre books
   */
  async openCalibreMultiSelectModal(books: Book[]): Promise<Book[]> {
    return new Promise((resolve, reject) => {
      new CalibreMultiSelectModal(
        this.app,
        books,
        this.settings.showCoverImageInSearch,
        (error, selectedBooks) => {
          if (error) {
            reject(error);
          } else {
            resolve(selectedBooks || []);
          }
        },
      ).open();
    });
  }

  async openNewBookNote(targetFile: TFile) {
    if (!this.settings.openPageOnCompletion) return;

    const activeLeaf = this.app.workspace.getLeaf();
    if (!activeLeaf) {
      console.warn("No active leaf");
      return;
    }

    await activeLeaf.openFile(targetFile, { state: { mode: "source" } });
    activeLeaf.setEphemeralState({ rename: "all" });
    await new CursorJumper(this.app).jumpToNextCursorLocation();
  }

  async openBookSearchModal(query = ""): Promise<Book[]> {
    return new Promise((resolve, reject) => {
      return new BookSearchModal(this, query, (error, results) => {
        return error ? reject(error) : resolve(results);
      }).open();
    });
  }

  async openBookSuggestModal(books: Book[]): Promise<Book> {
    return new Promise((resolve, reject) => {
      return new BookSuggestModal(
        this.app,
        this.settings.showCoverImageInSearch,
        books,
        (error, selectedBook) => {
          return error ? reject(error) : resolve(selectedBook);
        },
      ).open();
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  selectServiceAndSearch(event?: MouseEvent) {
    new ServiceSelectionModal(this).open();
  }
}

