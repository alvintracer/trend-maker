CREATE TABLE "trend_maker"."TrafficRedirectSetting" (
    "id" SERIAL NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "smartlinkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficRedirectSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrafficRedirectSetting_scope_key" ON "trend_maker"."TrafficRedirectSetting"("scope");
