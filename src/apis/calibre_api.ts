import { Book } from "@models/book.model";
import { BaseBooksApiImpl } from "@apis/base_api";
import { requestUrl } from "obsidian";

export class CalibreApi implements BaseBooksApiImpl {
  constructor(
    private readonly serverUrl: string,
    private readonly libraryId: string = "calibre",
  ) {}

  async getByQuery(query: string): Promise<Book[]> {
    try {
      // Use Calibre's AJAX search endpoint
      // GET /ajax/search?query={query}
      const searchUrl = `${this.serverUrl}/ajax/search?query=${encodeURIComponent(query)}`;

      const searchRes = await requestUrl({
        url: searchUrl,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (searchRes.status !== 200) {
        throw new Error(`Calibre Server returned status ${searchRes.status}`);
      }

      const searchData = searchRes.json;
      // searchData.book_ids is a list of book IDs
      const bookIds: string[] = searchData.book_ids || [];

      // Limit results to avoid overwhelming requests
      const topBookIds = bookIds.slice(0, 5);

      const books = await Promise.all(
        topBookIds.map((id) => this.getBookDetails(id)),
      );

      return books;
    } catch (error) {
      console.warn("Calibre search error", error);
      throw error;
    }
  }

  private async getBookDetails(id: string): Promise<Book> {
    // GET /ajax/book/{id}
    const bookUrl = `${this.serverUrl}/ajax/book/${id}`;
    const bookRes = await requestUrl({
      url: bookUrl,
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const data = bookRes.json;

    // Remove trailing slash from serverUrl if present
    const cleanServerUrl = this.serverUrl.replace(/\/$/, "");
    const validLibraryId = this.libraryId || "calibre";

    // Try to find cover in data, or construct standard URL
    // Standard Content Server URL: /get/cover/{book_id}/{library_id}
    // If data.cover is present, it might be a relative path.
    let coverUrl = "";
    if (data.cover) {
      coverUrl = data.cover;
      if (coverUrl.startsWith("/")) {
        coverUrl = `${cleanServerUrl}${coverUrl}`;
      }
    } else {
      coverUrl = `${cleanServerUrl}/get/cover/${id}/${validLibraryId}`;
    }

    // Map metadata
    // Calibre JSON structure (typical):
    // { title: "Title", authors: ["Author"], comments: "Desc", publisher: "Pub", pubdate: "YYYY-MM-DD...", user_categories: {}, ... }

    const title = data.title;
    const authors = data.authors || [];
    const author = authors.join(", ");
    // Clean HTML from comments/description
    const rawDescription = data.comments || "";
    // Simple regex to strip HTML tags if needed, though Obsidian renders HTML.
    // User requested sanitization for frontmatter earlier, so we might want to be careful.
    // But standard description scraping keeps HTML often.
    // Let's strip standard HTML tags for cleaner YAML if desired, or keep as is.
    // For consistency with other scrapers, we usually keep text.
    // Let's do a simple strip for safety or leave as is if user wants HTML.
    // Given previous request for sanitization, text-only is safer.
    const description = rawDescription.replace(/<[^>]*>?/gm, "");

    // ISBN
    // Calibre uses 'identifiers' map. In some versions/responses it might be directly in data or inside identifiers object.
    // The previous code looked at data.isbn. We need to look more robustly.
    // Also, user requested: "ids: isbn:9781101535455" -> We need to return ids with just the number.
    // However, the Book interface doesn't have 'ids'. I need to add it to Book model first or misuse another field.
    // Wait, the user said "ids: isbn:...". This implies the output format (YAML).
    // Let's assume the user wants this in the frontmatter.
    // Standard Book model has isbn13, isbn10.
    // I will look for 'isbn' in identifiers and set it to isbn13/10 or a new field if I can update the model.
    // The plan said "ids" field. I checked book.model.ts and it DOES NOT have ids. I must add it.

    // Let's first parse the identifiers properly.
    // data.identifiers is often { isbn: "..." } or similar.
    const identifiers = data.identifiers || {};
    let isbn = identifiers.isbn || data.isbn || "";

    // If isbn has prefix like "isbn:", remove it. User wants ONLY the number.
    if (isbn && typeof isbn === "string") {
      isbn = isbn.replace(/^isbn:/i, "");
    }

    const ids = isbn; // User wants this specific field handling.

    // Publisher
    const publisher = data.publisher || "";
    const publishDate = data.pubdate || "";

    // Published Date - Year only
    let publishedYear = "";
    if (publishDate) {
      try {
        const date = new Date(publishDate);
        if (!isNaN(date.getTime())) {
          publishedYear = date.getFullYear().toString();
        }
      } catch (e) {
        console.warn("Failed to parse date", publishDate);
      }
    }

    return {
      title,
      subtitle: "",
      author,
      authors,
      category: "",
      categories: data.tags || [],
      publisher,
      publishDate: publishedYear, // User wanted ONLY the year
      totalPage: "",
      coverUrl,
      coverSmallUrl: coverUrl,
      description,
      link: bookUrl,
      previewLink: bookUrl,
      isbn10: "",
      isbn13: isbn, // Keep standard fields too
      ids: ids, // New field
      originalTitle: "",
      translator: "",
      narrator: "",
    };
  }
}
