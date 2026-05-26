"use client";

import { useEffect } from "react";

import { getAdSlotDefinition, type AdSlotKey } from "@/lib/adsterra";

export function GlobalAdScripts({
  enabledKeys,
}: {
  enabledKeys: AdSlotKey[];
}) {
  useEffect(() => {
    const cleanupFns = enabledKeys.map((slotKey) => {
      const slot = getAdSlotDefinition(slotKey);

      if (slot.unit.kind !== "script") {
        return () => {};
      }

      const script = document.createElement("script");
      script.async = true;
      script.src = slot.unit.scriptSrc;
      script.dataset.slotKey = slotKey;
      document.body.appendChild(script);

      return () => {
        script.remove();
      };
    });

    return () => {
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, [enabledKeys]);

  return null;
}
