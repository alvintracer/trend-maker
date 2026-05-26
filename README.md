## Trend Maker

Bootstrap for a Korean trend keyword engine.

The current app includes:

- A Next.js 16 App Router project
- Seeded source registry for the initial Korean community targets
- Read-only API endpoints for source and pipeline boot data
- A dashboard page that shows the current source inventory and build order

## Sources

- `https://www.dcinside.com/`
- `https://mlbpark.donga.com/mp/`
- `https://www.fmkorea.com/`
- `https://www.dogdrip.net/`
- `https://theqoo.net/`
- `https://www.bobaedream.co.kr/list?code=best`

## Development

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

Initialize the database:

```bash
npm run db:migrate
npm run db:seed
```

Run the first source ingestion:

```bash
curl -X POST http://127.0.0.1:3001/api/ingest/dcinside
```

Verify `dcinside + fmkorea + mlbpark + dogdrip` ingestion and primary keyword generation:

```bash
npm run verify:primary
```

Verify secondary keyword generation:

```bash
npm run verify:secondary
```

Verify GPT keyword analysis generation:

```bash
OPENAI_API_KEY=your_key_here OPENAI_MODEL=gpt-5.4 npm run verify:analysis
```

Verify generated keyword pages:

```bash
npm run verify:pages
```

## Deployment

### Production database

Use a managed Postgres database such as Supabase.

Recommended Prisma wiring on Supabase:

- `DATABASE_URL`: transaction-mode pooler for runtime
- `DIRECT_URL`: session-mode pooler for schema sync / migrations
- use a dedicated Postgres schema for this app, for example `trend_maker`

Current production bootstrap:

1. Create a Supabase project.
2. Copy the transaction pooler and session pooler connection strings from Supabase.
3. Append `?schema=trend_maker` to both URLs.
4. Set `DATABASE_URL` and `DIRECT_URL` in Vercel Project Settings.
5. Sync the production schema with:

```bash
npm run db:migrate:deploy
```

At the moment this script uses `prisma db push` because the repository originally started on
SQLite during local prototyping. After the schema stabilizes further, you can re-baseline Prisma
migrations for a pure Postgres migration history.

### Required Vercel environment variables

Set these in Vercel Project Settings before the first production deployment:

```bash
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_SITE_URL=https://your-domain.com
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4
DISABLE_BROWSER_CRAWL=true
```

Notes:

- `NEXT_PUBLIC_SITE_URL` must match the canonical production domain.
- `DISABLE_BROWSER_CRAWL=true` is recommended on Vercel because the local FMKorea Chrome
  fallback is not available in the default serverless environment.

### GitHub + Vercel + domain sequence

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Add the environment variables above.
4. Deploy once to the preview or production environment.
5. Add the custom domain in Vercel Project Settings.
6. Point DNS to Vercel.
7. Update `NEXT_PUBLIC_SITE_URL` to the final production domain if needed.
8. Redeploy.

After deployment, verify:

- `/robots.txt`
- `/sitemap.xml`
- a published page under `/keywords/[slug]`
- canonical URL and robots metadata

### Post-deploy SEO checks

- Only `published` generated pages should be indexable.
- `/keywords` inventory should remain `noindex`.
- `sitemap.xml` should include only published generated pages.
- Search Console should be configured on the final production domain.

## Next Build Steps

1. Add persistent storage for `Source`, `RawDocument`, `Keyword`, and `KeywordAnalysis`.
2. Implement source-specific list crawlers and HTML normalization.
3. Add Korean keyword extraction and scoring.
4. Expand extracted keywords with Google Suggest caching and retry logic.
5. Add GPT-based keyword analysis and downstream page generation.

## Boot APIs

- `GET /api/sources`
- `GET /api/pipeline`
