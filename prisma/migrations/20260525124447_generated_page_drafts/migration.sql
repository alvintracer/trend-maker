-- CreateTable
CREATE TABLE "GeneratedPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keywordId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "faqRaw" TEXT,
    "relatedKeywordsRaw" TEXT,
    "canonicalPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastGeneratedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GeneratedPage_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPage_slug_key" ON "GeneratedPage"("slug");

-- CreateIndex
CREATE INDEX "GeneratedPage_status_lastGeneratedAt_idx" ON "GeneratedPage"("status", "lastGeneratedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedPage_keywordId_key" ON "GeneratedPage"("keywordId");
