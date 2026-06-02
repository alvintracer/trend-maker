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

export async function getLatestRawDocumentsBySourceExternalId(
  externalId: string,
  limit = 12,
) {
  return prisma.rawDocument.findMany({
    where: {
      source: {
        externalId,
      },
    },
    select: {
      id: true,
      url: true,
      title: true,
      crawledAt: true,
      source: {
        select: {
          name: true,
          externalId: true,
        },
      },
    },
    orderBy: [{ crawledAt: "desc" }, { id: "desc" }],
    take: limit,
  });
}

export async function getLatestRawDocumentsBySourceExternalIds(
  externalIds: string[],
  limitPerSource = 12,
) {
  const documents = await prisma.rawDocument.findMany({
    where: {
      source: {
        externalId: {
          in: externalIds,
        },
      },
    },
    select: {
      id: true,
      url: true,
      title: true,
      content: true,
      crawledAt: true,
      source: {
        select: {
          name: true,
          externalId: true,
        },
      },
    },
    orderBy: [{ crawledAt: "desc" }, { id: "desc" }],
    take: externalIds.length * Math.max(limitPerSource, 1) * 6,
  });

  const counts = new Map<string, number>();
  const filtered = documents.filter((document) => {
    const externalId = document.source.externalId;
    const current = counts.get(externalId) ?? 0;

    if (current >= limitPerSource) {
      return false;
    }

    counts.set(externalId, current + 1);
    return true;
  });

  return filtered;
}
