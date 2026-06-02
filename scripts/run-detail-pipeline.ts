import { ingestSource } from "@/lib/ingestion-service";
import { runTrackedFullPipeline } from "@/lib/full-pipeline-service";
import { promoteCommunityKeywordsToPrimary } from "@/lib/main-page-keywords";

async function main() {
  const forceRefresh = process.env.DETAIL_SECONDARY_FORCE_REFRESH !== "0";
  const maxPrimaryKeywords = Number.parseInt(process.env.DETAIL_MAX_PRIMARY_KEYWORDS ?? "30", 10);
  const maxSecondaryAnalyses = Number.parseInt(
    process.env.DETAIL_MAX_SECONDARY_ANALYSES ?? "60",
    10,
  );
  const limitPerPrimary = Number.parseInt(process.env.DETAIL_LIMIT_PER_PRIMARY ?? "10", 10);

  const communityPromotion = await promoteCommunityKeywordsToPrimary(3);
  console.log(`Promoted ${communityPromotion.promoted} community keywords to primary`);

  const dcbestIngest = await ingestSource("dcinside-dcbest");
  const result = await runTrackedFullPipeline({
    skipIngest: true,
    startFrom: "primary",
    endAt: "publish",
    primarySelection: "manual",
    secondaryForceRefresh: forceRefresh,
    publishEligible: true,
    maxPrimaryKeywords,
    maxSecondaryAnalyses,
    limitPerPrimary,
    cleanupStaleDetailData: true,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "detail-local-batch",
        dcbestIngest: {
          fetchedCount: dcbestIngest.fetchedCount,
          storedCount: dcbestIngest.storedCount,
          method: dcbestIngest.method,
        },
        pipelineRunId: result.runId,
        cleanup: result.cleanup,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown detail pipeline error",
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
