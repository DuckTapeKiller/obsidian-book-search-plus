import { Book } from '@models/book.model';
import { BookSearchPluginSettings } from '@settings/settings';
import { ServiceProvider } from '@src/constants';
import { requestUrl } from 'obsidian';
import { GoogleBooksApi } from './google_books_api';
import { GoodreadsApi } from './goodreads_api';
import { CalibreApi } from './calibre_api';

export interface BaseBooksApiImpl {
  getByQuery(query: string, options?: Record<string, string>): Promise<Book[]>;
  getBook?(book: Book): Promise<Book>;
}

export function factoryServiceProvider(
  settings: BookSearchPluginSettings,
  serviceProviderOverride?: string,
): BaseBooksApiImpl {
  // Fix: Cast the resulting string to the ServiceProvider enum
  const service = (serviceProviderOverride || settings.serviceProvider) as ServiceProvider;
  
  switch (service) {
    case ServiceProvider.google:
      return new GoogleBooksApi(settings.localePreference, settings.enableCoverImageEdgeCurl, settings.apiKey);
    case ServiceProvider.goodreads:
      return new GoodreadsApi();
    case ServiceProvider.calibre:
      return new CalibreApi(settings.calibreServerUrl, settings.calibreLibraryId);
    default:
      throw new Error('Unsupported service provider.');
  }
}

export async function apiGet<T>(
  url: string,
  params: Record<string, string | number> = {},
  headers?: Record<string, string>,
): Promise<T> {
  const apiURL = new URL(url);
  appendQueryParams(apiURL, params);

  const res = await requestUrl({
    url: apiURL.href,
    method: 'GET',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });

  return res.json as T;
}

function appendQueryParams(url: URL, params: Record<string, string | number>): void {
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value.toString());
  });
}
