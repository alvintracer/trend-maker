export type CrawledDocumentInput = {
  url: string;
  title: string;
  content: string;
  publishedAt?: Date;
};

export type CrawlResult = {
  documents: CrawledDocumentInput[];
  method: string;
  detail?: string;
};

export type SourceCrawler = {
  fetchDocuments: (url: string) => Promise<CrawlResult>;
};
