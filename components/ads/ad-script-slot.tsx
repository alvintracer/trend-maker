"use client";

import { useEffect, useRef } from "react";

import { getAdSlotDefinition, type AdSlotDefinition } from "@/lib/adsterra";

let bannerMountQueue = Promise.resolve();

function mountBanner(el: HTMLDivElement, slot: AdSlotDefinition) {
  if (slot.unit.kind !== "banner") {
    return Promise.resolve();
  }

  const unit = slot.unit;

  return new Promise<void>((resolve) => {
    const mountPoint = document.createElement("div");
    mountPoint.style.width = `${unit.width}px`;
    mountPoint.style.height = `${unit.height}px`;
    mountPoint.style.maxWidth = "100%";
    el.appendChild(mountPoint);

    (window as Window & { atOptions?: unknown }).atOptions = {
      key: unit.adKey,
      format: "iframe",
      height: unit.height,
      width: unit.width,
      params: {},
    };

    const invokeScript = document.createElement("script");
    invokeScript.type = "text/javascript";
    invokeScript.async = false;
    invokeScript.src = unit.scriptSrc;
    invokeScript.onload = () => resolve();
    invokeScript.onerror = () => resolve();

    mountPoint.appendChild(invokeScript);
  });
}

function mountNative(el: HTMLDivElement, slot: AdSlotDefinition) {
  const unit = slot.unit;
  if (unit.kind !== "native") {
    return;
  }

  const invokeScript = document.createElement("script");
  invokeScript.async = true;
  invokeScript.src = unit.scriptSrc;
  invokeScript.setAttribute("data-cfasync", "false");

  const container = document.createElement("div");
  container.id = unit.containerId;

  el.appendChild(invokeScript);
  el.appendChild(container);
}

export function AdScriptSlot({
  slotKey,
  className,
}: {
  slotKey: Parameters<typeof getAdSlotDefinition>[0];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;

    if (!el) {
      return;
    }

    const slot = getAdSlotDefinition(slotKey);
    el.innerHTML = "";
    let disposed = false;

    if (slot.unit.kind === "banner") {
      bannerMountQueue = bannerMountQueue.then(async () => {
        if (disposed) {
          return;
        }

        await mountBanner(el, slot);
      });
    } else if (slot.unit.kind === "native") {
      mountNative(el, slot);
    }

    return () => {
      disposed = true;
      el.innerHTML = "";
    };
  }, [slotKey]);

  return <div ref={ref} className={className} />;
}
