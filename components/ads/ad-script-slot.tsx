"use client";

import { useEffect, useRef } from "react";

import { getAdSlotDefinition, type AdSlotDefinition } from "@/lib/adsterra";

function mountBanner(el: HTMLDivElement, slot: AdSlotDefinition) {
  if (slot.unit.kind !== "banner") {
    return;
  }

  const configScript = document.createElement("script");
  configScript.type = "text/javascript";
  configScript.text = `atOptions = ${JSON.stringify({
    key: slot.unit.adKey,
    format: "iframe",
    height: slot.unit.height,
    width: slot.unit.width,
    params: {},
  })};`;

  const invokeScript = document.createElement("script");
  invokeScript.type = "text/javascript";
  invokeScript.async = true;
  invokeScript.src = slot.unit.scriptSrc;

  el.appendChild(configScript);
  el.appendChild(invokeScript);
}

function mountNative(el: HTMLDivElement, slot: AdSlotDefinition) {
  if (slot.unit.kind !== "native") {
    return;
  }

  const invokeScript = document.createElement("script");
  invokeScript.async = true;
  invokeScript.src = slot.unit.scriptSrc;
  invokeScript.setAttribute("data-cfasync", "false");

  const container = document.createElement("div");
  container.id = slot.unit.containerId;

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

    if (slot.unit.kind === "banner") {
      mountBanner(el, slot);
    } else if (slot.unit.kind === "native") {
      mountNative(el, slot);
    }

    return () => {
      el.innerHTML = "";
    };
  }, [slotKey]);

  return <div ref={ref} className={className} />;
}
