import { App, Modal, Setting, TFile } from "obsidian";

export enum DuplicateAction {
    OPEN_EXISTING = "open",
    CREATE_ANYWAY = "create",
    CANCEL = "cancel",
}

export class DuplicateCheckModal extends Modal {
    private result: DuplicateAction = DuplicateAction.CANCEL;
    private resolvePromise: ((value: DuplicateAction) => void) | null = null;

    constructor(
        app: App,
        private readonly existingFile: TFile,
        private readonly bookTitle: string,
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl, modalEl } = this;
        modalEl.addClass("book-search-duplicate-modal");

        contentEl.createEl("h2", { text: "Book Note Already Exists" });

        contentEl.createEl("p", {
            text: `A note for "${this.bookTitle}" already exists at:`,
        });

        contentEl.createEl("p", {
            cls: "duplicate-file-path",
            text: this.existingFile.path,
        });

        const buttonContainer = contentEl.createDiv({ cls: "duplicate-actions" });

        // Open Existing button
        const openBtn = buttonContainer.createEl("button", {
            text: "Open Existing",
            cls: "mod-cta",
        });
        openBtn.addEventListener("click", () => {
            this.result = DuplicateAction.OPEN_EXISTING;
            this.close();
        });

        // Create Anyway button
        const createBtn = buttonContainer.createEl("button", {
            text: "Create Anyway",
        });
        createBtn.addEventListener("click", () => {
            this.result = DuplicateAction.CREATE_ANYWAY;
            this.close();
        });

        // Cancel button
        const cancelBtn = buttonContainer.createEl("button", {
            text: "Cancel",
        });
        cancelBtn.addEventListener("click", () => {
            this.result = DuplicateAction.CANCEL;
            this.close();
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
        if (this.resolvePromise) {
            this.resolvePromise(this.result);
        }
    }

    /**
     * Open the modal and return a promise that resolves with the user's choice
     */
    async waitForChoice(): Promise<DuplicateAction> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.open();
        });
    }
}

/**
 * Check if a book note already exists in the vault
 */
export function findExistingBookNote(
    app: App,
    folder: string,
    bookTitle: string,
    isbn?: string,
): TFile | null {
    const files = app.vault.getMarkdownFiles();

    // Normalize the title for comparison
    const normalizedTitle = bookTitle.toLowerCase().trim();

    for (const file of files) {
        // Check if file is in the book folder
        if (folder && !file.path.startsWith(folder)) {
            continue;
        }

        // Check filename match
        const fileName = file.basename.toLowerCase();
        if (fileName.includes(normalizedTitle)) {
            return file;
        }

        // Check for ISBN match in frontmatter if provided
        if (isbn) {
            const cache = app.metadataCache.getFileCache(file);
            if (cache?.frontmatter) {
                const fm = cache.frontmatter;
                if (
                    fm.isbn === isbn ||
                    fm.isbn10 === isbn ||
                    fm.isbn13 === isbn ||
                    fm.ids === isbn
                ) {
                    return file;
                }
            }
        }
    }

    return null;
}
