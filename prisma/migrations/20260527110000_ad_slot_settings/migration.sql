CREATE TABLE "trend_maker"."AdSlotSetting" (
    "id" SERIAL NOT NULL,
    "slotKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSlotSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdSlotSetting_slotKey_key" ON "trend_maker"."AdSlotSetting"("slotKey");
