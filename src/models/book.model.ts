export interface FrontMatter {
  [key: string]: string | string[];
}

export interface Book {
  title: string; // 책 제목
  subtitle?: string;
  author: string; // 저자
  authors: string[];
  category?: string; // 카테고리
  categories?: string[];
  publisher?: string; // 출판사
  publishDate?: string; // 출판일
  totalPage?: number | string; // 전체 페이지
  coverUrl?: string; // 커버 URL
  coverSmallUrl?: string; // 커버 URL
  coverMediumUrl?: string; // 커버 URL
  coverLargeUrl?: string; // 커버 URL
  localCoverImage?: string;
  status?: string; // 읽기 상태(읽기전, 읽는중, 읽기완료)
  startReadDate?: string; // 읽기 시작한 일시
  finishReadDate?: string; // 읽기 완료한 일시
  myRate?: number | string; //나의 평점
  bookNote?: string; //서평 기록 여부
  isbn10?: string;
  isbn13?: string;
  isbn?: string;
  link?: string;
  description?: string;
  previewLink?: string;
  originalTitle?: string; // 원제
  translator?: string; // 번역가
  narrator?: string; // 낭독자
  asin?: string;
  tags?: string[];
  ids?: string;

  // Series information
  series?: string; // Series name
  seriesNumber?: number | string; // Book number in series
  seriesLink?: string; // Formatted as [[Series Name]]

  // Reading progress tracking
  currentPage?: number | string;
  readingProgress?: number | string; // Percentage 0-100

  // Custom Calibre columns (dynamic)
  customColumns?: Record<string, unknown>;

  // Source tracking for metadata updates
  sourceProvider?: string; // 'calibre', 'goodreads', 'google', etc.
  sourceId?: string; // ID in the source system
}

