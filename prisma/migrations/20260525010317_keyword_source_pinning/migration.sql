-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Keyword" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "parentKeywordId" INTEGER,
    "region" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "sourceIdsRaw" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" DATETIME,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Keyword_parentKeywordId_fkey" FOREIGN KEY ("parentKeywordId") REFERENCES "Keyword" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Keyword" ("createdAt", "firstSeenAt", "id", "language", "lastSeenAt", "level", "normalizedText", "parentKeywordId", "region", "sourceLabel", "status", "text", "updatedAt") SELECT "createdAt", "firstSeenAt", "id", "language", "lastSeenAt", "level", "normalizedText", "parentKeywordId", "region", "sourceLabel", "status", "text", "updatedAt" FROM "Keyword";
DROP TABLE "Keyword";
ALTER TABLE "new_Keyword" RENAME TO "Keyword";
CREATE UNIQUE INDEX "Keyword_normalizedText_key" ON "Keyword"("normalizedText");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
