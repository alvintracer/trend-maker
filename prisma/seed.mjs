import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sources = [
  {
    externalId: "dcinside",
    name: "DCInside",
    url: "https://www.dcinside.com/",
    kind: "community",
    category: "general trends",
    region: "KR",
    language: "ko",
    crawlIntervalHours: 24,
    trustScore: 72,
    status: "active",
    notes: "Large volume, fast trend detection, requires board-level targeting later.",
  },
  {
    externalId: "dcinside-dcbest",
    name: "DCInside DCBest",
    url: "https://gall.dcinside.com/board/lists?id=dcbest",
    kind: "aggregation",
    category: "best posts",
    region: "KR",
    language: "ko",
    crawlIntervalHours: 12,
    trustScore: 78,
    status: "active",
    notes: "Fetches DCBest pages 1 through 5 and stores row-level text fields for each list item.",
  },
  {
    externalId: "mlbpark",
    name: "MLBPark",
    url: "https://mlbpark.donga.com/mp/b.php?b=bullpen",
    kind: "forum",
    category: "community discussions",
    region: "KR",
    language: "ko",
    crawlIntervalHours: 24,
    trustScore: 67,
    status: "active",
    notes: "Useful for lifestyle, sports, and current-topic spikes.",
  },
  {
    externalId: "fmkorea",
    name: "FMKorea",
    url: "https://www.fmkorea.com/",
    kind: "community",
    category: "viral topics",
    region: "KR",
    language: "ko",
    crawlIntervalHours: 24,
    trustScore: 75,
    status: "active",
    notes: "High volume and meme diffusion, needs aggressive deduplication.",
  },
  {
    externalId: "dogdrip",
    name: "Dogdrip",
    url: "https://www.dogdrip.net/?mid=dogdrip&sort_index=popular",
    kind: "community",
    category: "viral community",
    region: "KR",
    language: "ko",
    crawlIntervalHours: 24,
    trustScore: 70,
    status: "active",
    notes: "Popular-post signal source with broad issue and meme coverage.",
  },
  {
    externalId: "theqoo",
    name: "theqoo",
    url: "https://theqoo.net/",
    kind: "community",
    category: "pop culture",
    region: "KR",
    language: "ko",
    crawlIntervalHours: 24,
    trustScore: 71,
    status: "active",
    notes: "Strong signal source for fandom, entertainment, and consumer topics.",
  },
  {
    externalId: "bobaedream-best",
    name: "Bobaedream Best",
    url: "https://www.bobaedream.co.kr/list?code=best",
    kind: "aggregation",
    category: "best posts",
    region: "KR",
    language: "ko",
    crawlIntervalHours: 24,
    trustScore: 64,
    status: "active",
    notes: "Opinion-heavy source. Good for urgency and controversy cues.",
  },
];

async function main() {
  for (const source of sources) {
    await prisma.source.upsert({
      where: { externalId: source.externalId },
      update: source,
      create: source,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
