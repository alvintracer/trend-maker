-- CreateTable
CREATE TABLE "Source" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "crawlIntervalHours" INTEGER NOT NULL,
    "trustScore" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT NOT NULL,
    "lastCrawledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RawDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "contentHash" TEXT,
    "publishedAt" DATETIME,
    "crawledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RawDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "parentKeywordId" INTEGER,
    "region" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Keyword_parentKeywordId_fkey" FOREIGN KEY ("parentKeywordId") REFERENCES "Keyword" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KeywordMetric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keywordId" INTEGER NOT NULL,
    "metricDate" DATETIME NOT NULL,
    "frequencyScore" REAL NOT NULL DEFAULT 0,
    "trendScore" REAL NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "suggestScore" REAL NOT NULL DEFAULT 0,
    "commercialScore" REAL NOT NULL DEFAULT 0,
    "opportunityScore" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeywordMetric_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KeywordAnalysis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keywordId" INTEGER NOT NULL,
    "intent" TEXT,
    "summary" TEXT,
    "relatedKeywordsRaw" TEXT,
    "faqRaw" TEXT,
    "snippetTitle" TEXT,
    "snippetDescription" TEXT,
    "model" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeywordAnalysis_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_externalId_key" ON "Source"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");

-- CreateIndex
CREATE UNIQUE INDEX "RawDocument_contentHash_key" ON "RawDocument"("contentHash");

-- CreateIndex
CREATE INDEX "RawDocument_sourceId_crawledAt_idx" ON "RawDocument"("sourceId", "crawledAt");

-- CreateIndex
CREATE UNIQUE INDEX "RawDocument_sourceId_url_key" ON "RawDocument"("sourceId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_normalizedText_key" ON "Keyword"("normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordMetric_keywordId_metricDate_key" ON "KeywordMetric"("keywordId", "metricDate");

-- CreateIndex
CREATE INDEX "KeywordAnalysis_keywordId_generatedAt_idx" ON "KeywordAnalysis"("keywordId", "generatedAt");
