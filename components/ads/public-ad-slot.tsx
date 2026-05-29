import { AdScriptSlot } from "@/components/ads/ad-script-slot";
import { getAdSlotDefinition, type AdSlotKey } from "@/lib/adsterra";

export function PublicAdSlot({
  slotKey,
  enabled,
  className,
  surfaceClassName,
}: {
  slotKey: AdSlotKey;
  enabled: boolean;
  className?: string;
  surfaceClassName?: string;
}) {
  if (!enabled) {
    return null;
  }

  const slot = getAdSlotDefinition(slotKey);
  let width: number | null = null;
  let height: number | null = null;

  if (slot.unit.kind === "banner") {
    width = slot.unit.width;
    height = slot.unit.height;
  }

  return (
    <div className={className}>
      <div
        className={
          surfaceClassName ??
          "overflow-hidden rounded-[24px] border border-black/10 bg-white/88 p-3 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur"
        }
      >
        <div className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          sponsored
        </div>
        <AdScriptSlot
          slotKey={slotKey}
          className="mx-auto flex min-h-[60px] items-center justify-center overflow-hidden"
        />
        {width && height ? (
          <>
            <div
              className="mx-auto"
              style={{
                width: Math.min(width, 728),
                maxWidth: "100%",
                minHeight: height,
              }}
            />
            <div className="mt-2 text-center text-[10px] text-slate-400">
              {width}x{height}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
