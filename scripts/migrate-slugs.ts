import { prisma } from "@/lib/prisma";

/**
 * Replicates the slugifyKeyword logic from generated-page-service.ts
 * to ensure consistency between migration and new page generation.
 */
function slugifyKeyword(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣ぁ-んァ-ヶー一-龯\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const KEYWORD_ID_SLUG_PATTERN = /^keyword-(\d+)$/;

async function main() {
  // Step 1: Find all GeneratedPages with keyword-{number} slugs
  const pages = await prisma.generatedPage.findMany({
    where: {
      slug: {
        startsWith: "keyword-",
      },
    },
    include: {
      keyword: {
        select: {
          id: true,
          text: true,
          normalizedText: true,
        },
      },
    },
  });

  // Filter to only pages where slug matches keyword-{number} exactly
  const stalePages = pages.filter((page) =>
    KEYWORD_ID_SLUG_PATTERN.test(page.slug),
  );

  console.log(
    `Found ${stalePages.length} pages with keyword-{id} slugs out of ${pages.length} total keyword- prefixed pages.`,
  );

  if (stalePages.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  // Step 2: Collect all existing slugs so we can detect conflicts
  const allPages = await prisma.generatedPage.findMany({
    select: {
      id: true,
      slug: true,
      keywordId: true,
    },
  });

  const existingSlugs = new Map(
    allPages.map((page) => [page.slug, page.keywordId]),
  );

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const page of stalePages) {
    const keywordText = page.keyword.normalizedText || page.keyword.text;
    const newBaseSlug = slugifyKeyword(keywordText);

    if (!newBaseSlug) {
      console.log(
        `  SKIP id=${page.id} slug="${page.slug}" — keyword text "${keywordText}" produces empty slug`,
      );
      skippedCount += 1;
      continue;
    }

    // Resolve a unique slug, trying baseSlug first, then baseSlug-keywordId, then baseSlug-2, -3, etc.
    let newSlug: string | null = null;
    const candidates = [newBaseSlug, `${newBaseSlug}-${page.keywordId}`];

    for (const candidate of candidates) {
      const owner = existingSlugs.get(candidate);

      if (!owner || owner === page.keywordId) {
        newSlug = candidate;
        break;
      }
    }

    if (!newSlug) {
      let suffix = 2;

      while (suffix < 10_000) {
        const candidate = `${newBaseSlug}-${suffix}`;
        const owner = existingSlugs.get(candidate);

        if (!owner || owner === page.keywordId) {
          newSlug = candidate;
          break;
        }

        suffix += 1;
      }
    }

    if (!newSlug) {
      console.log(
        `  ERROR id=${page.id} slug="${page.slug}" — could not resolve unique slug for "${keywordText}"`,
      );
      errorCount += 1;
      continue;
    }

    if (newSlug === page.slug) {
      console.log(
        `  SKIP id=${page.id} slug="${page.slug}" — already correct`,
      );
      skippedCount += 1;
      continue;
    }

    const newCanonicalPath = `/keywords/${newSlug}`;

    try {
      await prisma.generatedPage.update({
        where: { id: page.id },
        data: {
          slug: newSlug,
          canonicalPath: newCanonicalPath,
        },
      });

      // Update our in-memory map: remove old slug, add new one
      existingSlugs.delete(page.slug);
      existingSlugs.set(newSlug, page.keywordId);

      console.log(
        `  UPDATED id=${page.id}: "${page.slug}" → "${newSlug}" (canonical: ${newCanonicalPath})`,
      );
      updatedCount += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.log(
        `  ERROR id=${page.id} slug="${page.slug}" → "${newSlug}" — ${message}`,
      );
      errorCount += 1;
    }
  }

  console.log("\n=== Migration Summary ===");
  console.log(`  Total stale slugs found: ${stalePages.length}`);
  console.log(`  Updated: ${updatedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Errors:  ${errorCount}`);
}

main()
  .catch((error) => {
    console.error(
      "Migration failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
