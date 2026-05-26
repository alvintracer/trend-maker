import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { normalizeWhitespace } from "@/lib/normalize";
import type { CrawledDocumentInput } from "@/lib/crawler/types";

function hashDocument(input: CrawledDocumentInput) {
  return createHash("sha256")
    .update(`${input.url}\n${normalizeWhitespace(input.title)}\n${normalizeWhitespace(input.content)}`)
    .digest("hex");
}

export async function storeRawDocumentsForSource(
  sourceId: number,
  documents: CrawledDocumentInput[],
) {
  let createdCount = 0;

  for (const document of documents) {
    const contentHash = hashDocument(document);

    await prisma.rawDocument.upsert({
      where: {
        sourceId_url: {
          sourceId,
          url: document.url,
        },
      },
      update: {
        title: document.title,
        content: document.content,
        contentHash,
        publishedAt: document.publishedAt,
        crawledAt: new Date(),
      },
      create: {
        sourceId,
        url: document.url,
        title: document.title,
        content: document.content,
        contentHash,
        publishedAt: document.publishedAt,
      },
    });

    createdCount += 1;
  }

  return { storedCount: createdCount };
}

export async function getRawDocumentCount() {
  return prisma.rawDocument.count();
}
