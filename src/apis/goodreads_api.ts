import { Book } from '@models/book.model';
import { BaseBooksApiImpl } from '@apis/base_api';
import { requestUrl } from 'obsidian';
import * as cheerio from 'cheerio';

export class GoodreadsApi implements BaseBooksApiImpl {
  constructor() {}

  async getByQuery(query: string): Promise<Book[]> {
    try {
      const searchUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(query)}`;
      const searchRes = await requestUrl({
        url: searchUrl,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const $ = cheerio.load(searchRes.text);
      const books: Book[] = [];

      // 1. Check if redirected to a book page directly (single result)
      if ($('h1[data-testid="bookTitle"]').length > 0 || $('#bookTitle').length > 0) {
        const book = this.extractBook($, searchUrl);
        const canonical = $('link[rel="canonical"]').attr('href') || searchUrl;
        book.link = canonical;
        book.previewLink = canonical;
        return [book];
      }

      // 2. Parse Search Results List (Table View)
      const tableRows = $('table.tableList tr');
      if (tableRows.length > 0) {
        tableRows.each((_, el) => {
          const row = $(el);
          const titleLink = row.find('a.bookTitle');
          const title = titleLink.text().trim().replace(/"/g, "'");
          const href = titleLink.attr('href');

          if (!title || !href) return;

          const author = row.find('a.authorName').first().text().trim();
          const coverUrl = row.find('img.bookCover').attr('src');
          const smallCoverUrl = coverUrl;

          const fullLink = href.startsWith('http') ? href : `https://www.goodreads.com${href}`;

          books.push({
            title,
            author,
            authors: [author],
            link: fullLink,
            previewLink: fullLink,
            coverUrl: coverUrl?.replace(/_SY\d+_/, '_SY475_').replace(/_SX\d+_/, '_SX475_') || '', // Try to get higher res
            coverSmallUrl: smallCoverUrl || '',
            description: '',
            publisher: '',
            publishDate: '',
            totalPage: '',
            isbn10: '',
            isbn13: '',
            categories: [],
            category: '',
            originalTitle: '',
            translator: '',
            narrator: '',
            subtitle: '',
            asin: '',
          });
        });
        return books;
      }

      return books;
    } catch (error) {
      console.warn('Goodreads scraping error', error);
      throw error;
    }
  }

  async getBook(book: Book): Promise<Book> {
    try {
      const bookRes = await requestUrl({
        url: book.link,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const $ = cheerio.load(bookRes.text);
      return this.extractBook($, book.link);
    } catch (error) {
      console.warn('Goodreads getBook error', error);
      return book;
    }
  }

  private extractBook($: ReturnType<typeof cheerio.load>, link: string): Book {
    // 1. Título
    const title =
      $('h1[data-testid="bookTitle"]').first().text().trim() || $('#bookTitle').text().trim().replace(/"/g, "'");

    // 2. Autor (a)
    const authors: string[] = [];
    $('.ContributorLink__name[data-testid="name"]').each((_, el) => {
      authors.push($(el).text().trim());
    });
    if (authors.length === 0) {
      // Fallback for older pages
      $('a.authorName').each((_, el) => authors.push($(el).text().trim()));
    }
    const authorString = authors[0] || '';

    // 3. Resumen
    const description = $('span.Formatted').first().text().trim().replace(/"/g, "'");

    // 4. Género
    const categories: string[] = [];
    $('ul[aria-label="Top genres for this book"] a.Button--tag').each((_, el) => {
      categories.push($(el).text().trim());
    });
    const category = categories.join(', ');

    // 5. ASIN
    let asin = $('span[data-testid="asin"]').first().text().trim();

    // 6. Data from __NEXT_DATA__ (Original Title, Publisher, ISBNs, Publication Date)
    const scriptContent = $('#__NEXT_DATA__').html();
    let originalTitle = '';
    let publisher = '';
    let isbn10 = '';
    let isbn13 = '';
    let publishDate = '';
    let totalPage = '';
    let coverUrl = '';

    if (scriptContent) {
      try {
        // 1. Original Title
        // Simplified Regex: /"originalTitle":"(.*?)"/
        const originalTitleMatch = scriptContent.match(/.*"Work:.*?"details":.*?"originalTitle":"(.*?)".*/);
        if (originalTitleMatch && originalTitleMatch[1]) {
          originalTitle = originalTitleMatch[1];
        }

        // 2. Publisher
        // Simplified Regex: /"publisher":"(.*?)"/
        const publisherMatch = scriptContent.match(/"publisher":"(.*?)"/);
        if (publisherMatch && publisherMatch[1]) {
          publisher = publisherMatch[1];
        }

        // 3. ISBN 10
        // Simplified Regex: /"isbn":"(.*?)"/
        const isbn10Match = scriptContent.match(/"isbn":"(.*?)"/);
        if (isbn10Match && isbn10Match[1]) {
          isbn10 = isbn10Match[1];
        }

        // 4. Publication Date
        // Simplified Regex: /"publicationTime":(-?\d+)/ (handles negative timestamps for pre-1970)
        const pubDateMatch = scriptContent.match(/"publicationTime":(-?\d+)/);
        if (pubDateMatch && pubDateMatch[1]) {
          const timestamp = parseInt(pubDateMatch[1], 10);
          const date = new Date(timestamp);
          if (!isNaN(date.getTime())) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            publishDate = `${year}/${month}/${day}`;
          }
        }

        // 5. ASIN (Fallback if span not found)
        // Simplified Regex: /"asin":"(.*?)"/
        if (!asin) {
          const asinMatch = scriptContent.match(/"asin":"(.*?)"/);
          if (asinMatch && asinMatch[1]) {
            asin = asinMatch[1];
          }
        }
      } catch (e) {
        console.warn('Goodreads Regex parse error', e);
      }
    }

    // ISBN 10 Fallback / Cleanup
    // User regex: selector:#__NEXT_DATA__|replace:"/.*BookDetails.*?\"isbn\":\"(.*?)\".*/":"$1"
    // I handled this above.

    // ISBN 13
    // User value: {{schema:isbn}}
    // Try to find schema.org script
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');
        if (data['@type'] === 'Book') {
          if (data.isbn) isbn13 = data.isbn;
          if (data.numberOfPages) {
            totalPage = data.numberOfPages.toString();
          }
          if (!coverUrl && data.image) coverUrl = data.image;
        }
      } catch (e) {
        // ignore schema parse errors
      }
    });

    // Páginas (fallback if not in schema)
    if (!totalPage) {
      // User regex: {{schema:numberOfPages}} which I tried above.
      // Fallback to text
      const pagesText = $('p[data-testid="pagesFormat"]').text();
      if (pagesText) {
        totalPage = pagesText.split(' ')[0];
      }
    }

    // Cover Image
    // User value: {{localCoverImage}} -> implies downloading.
    // We need to scrape the URL.
    if (!coverUrl) {
      coverUrl = $('img.ResponsiveImage').attr('src') || $('#coverImage').attr('src') || '';
    }
    // Try to get high-res
    coverUrl = coverUrl.replace(/_SY\d+_/, '_SY475_').replace(/_SX\d+_/, '_SX475_');

    return {
      title,
      subtitle: '',
      author: authorString,
      authors: authors.length ? authors : [authorString],
      category,
      categories,
      publisher,
      publishDate,
      totalPage,
      coverUrl,
      coverSmallUrl: coverUrl,
      description,
      link,
      previewLink: link,
      isbn10,
      isbn13: isbn13 || isbn10,
      originalTitle,
      translator: '',
      narrator: '',
      asin,
    };
  }
}
