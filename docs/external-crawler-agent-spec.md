# External Crawler Agent Spec

이 문서는 별도 로컬 Python 크롤링 서버가 `trend-maker` 프로젝트에 필요한 크롤링 데이터를 Supabase(Postgres)에 직접 공급하기 위한 구현 지시사항이다.

목표는 현재 Next.js 앱 내부에서 돌고 있는 크롤링을 외부 Python 작업기로 분리하는 것이다.

## 1. 목표

크롤링 서버는 아래 2개 축을 담당한다.

### A. 메인페이지 매니지먼트

여러 커뮤니티 사이트의 인기 게시글 `제목 + 링크`를 수집해서 DB에 넣는다.

현재 메인페이지용 소스:

- `dcinside-dcbest-lite`
- `fmkorea-best2`
- `arca-live`
- `dogdrip-popular`
- `dogdrip-userdog`

이 데이터는 현재 공개 홈 `/` 에서 사용된다.

### B. 상세페이지 매니지먼트용 재료 수집

상세페이지 생성 시 사용하는 원문 재료를 공급한다.

현재 우선 대상:

- `dcinside-dcbest`

이 소스는 메인페이지용이 아니라, 상세페이지 생성 시 참조하는 재료 저장소 역할이다.

## 2. 현재 앱 구조상 중요한 사실

이 프로젝트는 크롤링 결과를 `trend_maker.Source`, `trend_maker.RawDocument` 테이블에 저장해 사용한다.

핵심 규칙:

- `Source.externalId` 로 소스를 식별한다.
- 실제 크롤링 결과는 `RawDocument` 에 저장한다.
- 중복 기준은 `(sourceId, url)` 이다.
- 같은 URL이면 `update`, 새 URL이면 `insert` 한다.
- `contentHash` 는 `url + normalized(title) + normalized(content)` 기반 SHA256 이어야 한다.

현재 Next 앱의 내부 크롤링 로직을 외부로 옮기더라도, DB write contract는 유지해야 한다.

## 3. 절대 지켜야 할 DB Contract

대상 스키마: `trend_maker`

핵심 테이블:

- `trend_maker."Source"`
- `trend_maker."RawDocument"`
- `trend_maker."MainPageSourceSetting"`: 읽기만 참고 가능, 필수 write 대상은 아님

### Source 테이블 주요 컬럼

- `id`
- `externalId` unique
- `name`
- `url` unique
- `kind`
- `category`
- `region`
- `language`
- `crawlIntervalHours`
- `trustScore`
- `status`
- `notes`
- `lastCrawledAt`
- `lastCrawlStatus`
- `lastCrawlMethod`
- `lastCrawlDetail`

### RawDocument 테이블 주요 컬럼

- `id`
- `sourceId`
- `url`
- `title`
- `content`
- `contentHash`
- `publishedAt`
- `crawledAt`

제약:

- `@@unique([sourceId, url])`
- `contentHash` unique

## 4. 소스별 저장 규칙

### 4.1 메인페이지용 소스

메인페이지용은 모두 경량 저장으로 통일한다.

저장 규칙:

- `title`: 게시글 제목
- `url`: 게시글 원문 링크
- `content`: 제목과 동일 문자열
- `publishedAt`: 가능하면 원문 시간 파싱, 불가능하면 `NULL`
- `lastCrawlMethod`: `fetch` 또는 `browser`
- `lastCrawlDetail`: 사람이 읽을 수 있는 짧은 요약

#### `dcinside-dcbest-lite`

- 대상: DCBest 1~5 페이지
- 목적: 메인페이지 노출용
- 저장: 제목 + 링크만

#### `fmkorea-best2`

- 대상:
  - `https://www.fmkorea.com/index.php?mid=best2&page=1`
  - page 2~5
- 저장: 제목 + 링크만

#### `arca-live`

- 대상: `https://arca.live/`
- 저장: 제목 + 링크만

#### `dogdrip-popular`

- 대상:
  - `https://www.dogdrip.net/dogdrip?sort_index=popular&page=1`
  - page 2~3
- 저장: 제목 + 링크만

#### `dogdrip-userdog`

- 대상:
  - `https://www.dogdrip.net/?mid=userdog&sort_index=popular`
  - page 2~3
- 저장: 제목 + 링크만

### 4.2 상세페이지 재료용 소스

#### `dcinside-dcbest`

이건 경량 저장이 아니다.

상세페이지 생성 로직이 현재 `content` 안의 구조화된 라인 포맷을 기대한다.

반드시 아래 포맷을 유지해야 한다:

```text
gallery:{gallery_name}
title:{post_title}
comments:{comment_count}
author:{author_name}
date:{date_text}
views:{views}
recommends:{recommends}
row:{entire_row_text}
```

필드가 비어 있으면 해당 라인은 생략 가능하다. 하지만 `title:` 은 반드시 있어야 한다.

저장 규칙:

- `title`: 게시글 제목
- `url`: 게시글 원문 링크
- `content`: 위 구조화 텍스트
- `publishedAt`: 가능하면 파싱, 불가능하면 `NULL`

이 포맷이 깨지면 현재 상세페이지 생성 로직이 재료 해석을 못 한다.

## 5. Source 레지스트리 고정값

외부 에이전트는 아래 `Source.externalId` 들을 기준으로 동작해야 한다.

메인페이지용:

- `dcinside-dcbest-lite`
- `fmkorea-best2`
- `arca-live`
- `dogdrip-popular`
- `dogdrip-userdog`

상세페이지 재료용:

- `dcinside-dcbest`

가능하면 크롤링 시작 전에 `Source` 레코드가 없으면 upsert로 보정하라.

권장 방식:

1. 앱 repo의 `lib/seed-data.ts` 값을 그대로 Python 쪽 상수로 복제
2. 시작 시 `Source.externalId` 기준 upsert
3. 이후 크롤링 결과 저장

## 6. Source 상태 업데이트 규칙

크롤링 성공 시:

- `lastCrawledAt = now()`
- `lastCrawlStatus = 'success'`
- `lastCrawlMethod = 'fetch'` 또는 `'browser'`
- `lastCrawlDetail = 짧은 요약`

크롤링 실패 시:

- `lastCrawlStatus = 'error'`
- `lastCrawlMethod = NULL` 또는 마지막 사용값 유지 중 택1
- `lastCrawlDetail = 에러 메시지 500자 이하`

실패해도 프로세스 전체가 죽지 않게 source 단위로 격리할 것.

## 7. 중복 제거 규칙

필수:

- 같은 source에서 같은 URL은 항상 같은 문서로 취급
- `(sourceId, url)` 기준 upsert

추가 권장:

- 한 번의 crawl batch 안에서 `url + title` dedupe
- HTML 내 반복 노출 링크 제거

`contentHash` 생성 규칙:

```text
sha256(
  url + "\n" +
  normalizeWhitespace(title) + "\n" +
  normalizeWhitespace(content)
)
```

`normalizeWhitespace` 의미:

- 연속 공백을 하나로
- 앞뒤 공백 제거

## 8. 브라우저 fallback 규칙

아래 상황이면 `Playwright` fallback을 사용하라.

- HTTP 403
- anti-bot 차단
- fetch 결과는 200이지만 문서 수가 0
- required selector가 비어 있음

권장 전략:

1. 먼저 `requests/httpx` 또는 기본 fetch 성격의 HTTP 수집
2. 실패하면 Playwright headless Chromium
3. Playwright도 실패하면 source 상태 `error`

각 source 결과에 사용한 방식을 `lastCrawlMethod` 로 남겨라.

## 9. 추천 Python 프로젝트 구조

```text
crawler_agent/
  app/
    config.py
    db.py
    models.py
    utils/
      text.py
      hashing.py
      logging.py
    sources/
      dcinside_dcbest.py
      dcinside_dcbest_lite.py
      fmkorea_best2.py
      arca_live.py
      dogdrip_popular.py
      dogdrip_userdog.py
    jobs/
      source_registry.py
      ingest_main_page.py
      ingest_detail_materials.py
      scheduler.py
    main.py
```

## 10. DB 접근 방식

추천 우선순위:

1. `psycopg` 또는 SQLAlchemy Core로 Postgres 직접 접근
2. 또는 Supabase Postgres direct connection 사용

권장 이유:

- upsert 제어가 쉬움
- batch insert/update 성능이 나음
- `ON CONFLICT` 다루기 편함

필요 환경변수 예시:

```bash
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
CRAWLER_TIMEZONE=Asia/Seoul
LOG_LEVEL=INFO

DCINSIDE_CHROME_EXECUTABLE=/path/to/chrome
FMKOREA_CHROME_EXECUTABLE=/path/to/chrome
ARCA_CHROME_EXECUTABLE=/path/to/chrome
DOGDRIP_CHROME_EXECUTABLE=/path/to/chrome
```

## 11. Upsert 구현 규칙

### 11.1 Source upsert

`externalId` 기준 upsert.

업데이트 대상:

- `name`
- `url`
- `kind`
- `category`
- `region`
- `language`
- `crawlIntervalHours`
- `trustScore`
- `status`
- `notes`

### 11.2 RawDocument upsert

`(sourceId, url)` 기준 upsert.

업데이트 대상:

- `title`
- `content`
- `contentHash`
- `publishedAt`
- `crawledAt = now()`

중요:

- 기존 row가 있어도 `crawledAt` 은 매 crawl마다 최신으로 갱신

## 12. 실행 스케줄 권장안

### 메인페이지용

수동 실행 + Python 서버 자체 스케줄 권장

권장 주기:

- `dcinside-dcbest-lite`: 15~30분
- `fmkorea-best2`: 30분
- `arca-live`: 30분
- `dogdrip-popular`: 30분
- `dogdrip-userdog`: 30분

### 상세페이지 재료용

- `dcinside-dcbest`: 1~3시간

주의:

현재 Vercel Hobby cron 제한 때문에 앱 쪽 자동 갱신은 하루 1회만 의미가 있다.
실시간성은 Python 서버 스케줄러가 담당하는 것이 맞다.

## 13. Namu Wiki 관련 별도 메모

현재 나무위키 AV 배우 정보 수집은 앱 내부 `lib/namu-av-actors.ts` 에 직접 fetch 로직이 있다.

즉, 지금 구조에서는 나무위키가 `RawDocument` 기반으로 소비되지 않는다.

따라서 외부 Python 서버가 “지금 즉시” 대체 가능한 크롤링 범위는:

- 메인페이지용 커뮤니티 소스 전부
- 상세페이지 재료용 `dcinside-dcbest`

나무위키까지 외부화하려면 추가 설계가 필요하다.

권장 2안 중 하나:

1. `RawDocument` 에 `namu-av-info` 같은 source를 새로 만들고 HTML snapshot 저장
2. 별도 `crawl_snapshots` 테이블 또는 Supabase Storage에 HTML 저장

그리고 이후 Next 앱이 그 snapshot을 읽도록 변경해야 한다.

이번 1차 작업에서는 나무위키는 제외해도 된다.

## 14. 검증 체크리스트

외부 에이전트는 구현 후 아래를 검증해야 한다.

### A. Source row 검증

- 지정한 `externalId` 들이 `Source` 에 존재
- 최근 실행 시 `lastCrawledAt` 갱신
- 성공/실패 상태 반영

### B. RawDocument row 검증

- 각 source마다 문서가 들어감
- URL 중복 없이 upsert 됨
- `title`, `content` 값이 기대 형식

### C. 앱 소비 검증

메인페이지:

- `/` 에 게시글 제목이 보임
- source label이 정상 표시됨

상세페이지:

- `dcinside-dcbest` 재료를 읽는 상세페이지 생성 파이프라인이 깨지지 않음

## 15. 완료 기준

아래를 만족하면 1차 완료로 본다.

1. Python 작업기가 `Source` 와 `RawDocument` 를 직접 upsert 한다.
2. 메인페이지용 5개 소스가 자동/수동으로 갱신된다.
3. `dcinside-dcbest` 재료용 문서가 구조화 포맷으로 저장된다.
4. 앱 내부 크롤링 없이도 홈과 상세페이지 재료가 유지된다.
5. source 단위 로그와 실패 처리가 있다.

## 16. 구현 지시사항 요약

다른 에이전트에게는 아래처럼 지시하면 된다.

> 이 프로젝트의 외부 Python 크롤링 서버를 구현하라.
> 목표는 `trend_maker.Source` 와 `trend_maker.RawDocument` 에 직접 데이터를 넣는 것이다.
> 메인페이지용 소스는 `dcinside-dcbest-lite`, `fmkorea-best2`, `arca-live`, `dogdrip-popular`, `dogdrip-userdog` 이다.
> 상세페이지 재료용 소스는 `dcinside-dcbest` 이다.
> 메인페이지용은 제목+링크만 저장하고 `content=title` 로 넣어라.
> `dcinside-dcbest` 는 `gallery/title/comments/author/date/views/recommends/row` 라인 포맷을 유지하라.
> `Source.externalId` 기준 source upsert, `(sourceId,url)` 기준 raw document upsert를 구현하라.
> fetch 실패, 403, 빈 결과 시 Playwright fallback을 사용하라.
> source별 성공/실패 상태를 `lastCrawledAt`, `lastCrawlStatus`, `lastCrawlMethod`, `lastCrawlDetail` 에 기록하라.
> Namu Wiki 외부화는 이번 단계에서 제외하라.

