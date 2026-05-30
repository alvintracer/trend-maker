import { AdScriptSlot } from "@/components/ads/ad-script-slot";
import { ResponsiveAdWrapper } from "@/components/ads/responsive-ad-wrapper";
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

  const baseSurfaceClass = surfaceClassName ?? "overflow-hidden rounded-[24px] border border-black/10 bg-white/88 p-3 shadow-[0_16px_60px_rgba(53,58,42,0.08)] backdrop-blur";
  const finalSurfaceClass = `${baseSurfaceClass} w-full max-w-full overflow-hidden`;

  return (
    <div className={`${className ?? ""} w-full max-w-full min-w-0`}>
      <div className={finalSurfaceClass}>
        {width && height ? (
          <ResponsiveAdWrapper width={width} height={height}>
            <AdScriptSlot
              slotKey={slotKey}
              className="mx-auto flex items-center justify-center overflow-hidden"
            />
          </ResponsiveAdWrapper>
        ) : (
          <AdScriptSlot
            slotKey={slotKey}
            className="mx-auto flex min-h-[60px] items-center justify-center overflow-hidden"
          />
        )}
      </div>
    </div>
  );
}
