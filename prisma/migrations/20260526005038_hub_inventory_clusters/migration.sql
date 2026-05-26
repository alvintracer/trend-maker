-- CreateTable
CREATE TABLE "Hub" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "summary" TEXT,
    "primaryKeywordId" INTEGER,
    "representativeKeywordId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastComputedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hub_primaryKeywordId_fkey" FOREIGN KEY ("primaryKeywordId") REFERENCES "Keyword" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Hub_representativeKeywordId_fkey" FOREIGN KEY ("representativeKeywordId") REFERENCES "Keyword" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GeneratedPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keywordId" INTEGER NOT NULL,
    "hubId" INTEGER,
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
    CONSTRAINT "GeneratedPage_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneratedPage_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GeneratedPage" ("canonicalPath", "createdAt", "description", "faqRaw", "h1", "id", "keywordId", "lastGeneratedAt", "relatedKeywordsRaw", "slug", "status", "summary", "title", "updatedAt") SELECT "canonicalPath", "createdAt", "description", "faqRaw", "h1", "id", "keywordId", "lastGeneratedAt", "relatedKeywordsRaw", "slug", "status", "summary", "title", "updatedAt" FROM "GeneratedPage";
DROP TABLE "GeneratedPage";
ALTER TABLE "new_GeneratedPage" RENAME TO "GeneratedPage";
CREATE UNIQUE INDEX "GeneratedPage_hubId_key" ON "GeneratedPage"("hubId");
CREATE UNIQUE INDEX "GeneratedPage_slug_key" ON "GeneratedPage"("slug");
CREATE INDEX "GeneratedPage_status_lastGeneratedAt_idx" ON "GeneratedPage"("status", "lastGeneratedAt");
CREATE UNIQUE INDEX "GeneratedPage_keywordId_key" ON "GeneratedPage"("keywordId");
CREATE TABLE "new_Keyword" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "parentKeywordId" INTEGER,
    "hubId" INTEGER,
    "region" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "sourceIdsRaw" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" DATETIME,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Keyword_parentKeywordId_fkey" FOREIGN KEY ("parentKeywordId") REFERENCES "Keyword" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Keyword_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Keyword" ("createdAt", "firstSeenAt", "id", "isManual", "language", "lastSeenAt", "level", "normalizedText", "parentKeywordId", "pinned", "pinnedAt", "region", "sourceIdsRaw", "sourceLabel", "status", "text", "updatedAt") SELECT "createdAt", "firstSeenAt", "id", "isManual", "language", "lastSeenAt", "level", "normalizedText", "parentKeywordId", "pinned", "pinnedAt", "region", "sourceIdsRaw", "sourceLabel", "status", "text", "updatedAt" FROM "Keyword";
DROP TABLE "Keyword";
ALTER TABLE "new_Keyword" RENAME TO "Keyword";
CREATE UNIQUE INDEX "Keyword_normalizedText_key" ON "Keyword"("normalizedText");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Hub_slug_key" ON "Hub"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_normalizedName_key" ON "Hub"("normalizedName");

-- CreateIndex
CREATE INDEX "Hub_status_lastComputedAt_idx" ON "Hub"("status", "lastComputedAt");
