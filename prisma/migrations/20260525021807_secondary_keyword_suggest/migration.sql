-- CreateTable
CREATE TABLE "KeywordSuggestResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parentKeywordId" INTEGER NOT NULL,
    "suggestedKeywordId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "query" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeywordSuggestResult_parentKeywordId_fkey" FOREIGN KEY ("parentKeywordId") REFERENCES "Keyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KeywordSuggestResult_suggestedKeywordId_fkey" FOREIGN KEY ("suggestedKeywordId") REFERENCES "Keyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KeywordSuggestResult_parentKeywordId_fetchedAt_idx" ON "KeywordSuggestResult"("parentKeywordId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordSuggestResult_parentKeywordId_suggestedKeywordId_provider_key" ON "KeywordSuggestResult"("parentKeywordId", "suggestedKeywordId", "provider");
