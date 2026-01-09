import { Book } from "@models/book.model";
import { BaseBooksApiImpl } from "@apis/base_api";
import { requestUrl } from "obsidian";

interface OpenLibraryDoc {
  title: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  first_publish_year?: number;
  publish_date?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
  number_of_pages?: number;
  key?: string;
  subject?: string[];
  original_title?: string;
}

export class OpenLibraryApi implements BaseBooksApiImpl {
  async getByQuery(query: string): Promise<Book[]> {
    try {
      // Use general search for better results: https://openlibrary.org/dev/docs/api/search
      const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}`;

      const searchRes = await requestUrl({
        url: searchUrl,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (searchRes.status !== 200) {
        return [];
      }

      const results = searchRes.json;
      if (!results.docs || !Array.isArray(results.docs)) {
        return [];
      }

      return results.docs.map((doc: OpenLibraryDoc) =>
        this.mapResultToBook(doc),
      );
    } catch (error) {
      console.warn("OpenLibrary search error", error);
      return [];
    }
  }

  async getBook(book: Book): Promise<Book> {
    // OpenLibrary search results usually contain enough info, but we can implement specific fetch if needed
    // For now, return the book as is from search result, effectively relying on mapResultToBook
    return book;
  }

  private mapResultToBook(doc: OpenLibraryDoc): Book {
    const title = doc.title || "";
    const author = doc.author_name ? doc.author_name[0] : "";
    const authors = doc.author_name || [];

    // Cover Image
    let coverUrl = "";
    if (doc.cover_i) {
      coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    } else if (doc.isbn && doc.isbn[0]) {
      coverUrl = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
    }

    // Publish Date - OpenLibrary gives multiple, pick first valid
    let publishDate = "";
    if (doc.first_publish_year) {
      publishDate = doc.first_publish_year.toString();
    } else if (doc.publish_date && doc.publish_date.length > 0) {
      publishDate = doc.publish_date[0];
    }

    // Publisher
    const publisher = doc.publisher ? doc.publisher[0] : "";

    // ISBN
    const isbn10 =
      (doc.isbn || []).find((id: string) => id.length === 10) || "";
    const isbn13 =
      (doc.isbn || []).find((id: string) => id.length === 13) || "";

    // Pages
    const totalPage =
      doc.number_of_pages_median ||
      (doc.number_of_pages ? doc.number_of_pages : "");

    // Link
    const key = doc.key;
    const link = key ? `https://openlibrary.org${key}` : "";

    return {
      title,
      author,
      authors,
      coverUrl,
      coverSmallUrl: coverUrl, // OpenLibrary covers are usually high enough res or scalable
      publishDate,
      publisher,
      isbn10,
      isbn13,
      totalPage,
      link,
      previewLink: link,
      description: "", // Search API doesn't always return full description
      categories: doc.subject || [],
      category: doc.subject ? doc.subject[0] : "",
      asin: "", // OpenLibrary doesn't use ASIN usually
      originalTitle: doc.original_title || "",
      tags: [], // Initialize tags empty, main.ts populates them
    };
  }
}
