CREATE TABLE "trend_maker"."PublishSetting" (
    "id" SERIAL NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'default',
    "minRepresentativeOpportunity" DOUBLE PRECISION NOT NULL DEFAULT 14,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublishSetting_scope_key" ON "trend_maker"."PublishSetting"("scope");
