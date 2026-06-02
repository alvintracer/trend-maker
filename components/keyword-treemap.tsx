"use client";

import { useEffect, useRef, useState } from "react";

type TreemapItem = {
  text: string;
  value: number;
  href: string | null;
};

type KeywordTreemapProps = {
  items: TreemapItem[];
};

type LayoutRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  item: TreemapItem;
};

function squarify(
  items: TreemapItem[],
  containerWidth: number,
  containerHeight: number,
): LayoutRect[] {
  if (items.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return [];
  }

  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  if (totalValue === 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects: LayoutRect[] = [];

  let x = 0;
  let y = 0;
  let w = containerWidth;
  let h = containerHeight;
  let remaining = [...sorted];
  let remainingValue = totalValue;

  while (remaining.length > 0) {
    const isHorizontal = w >= h;
    const side = isHorizontal ? h : w;

    let row: TreemapItem[] = [];
    let rowValue = 0;
    let bestAspectRatio = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]];
      const candidateValue = rowValue + remaining[i].value;
      const rowArea = (candidateValue / remainingValue) * w * h;
      const rowSide = rowArea / side;

      let worstAspect = 0;
      for (const item of candidate) {
        const itemArea = (item.value / candidateValue) * rowArea;
        const itemSide = itemArea / rowSide;
        const aspect = Math.max(rowSide / itemSide, itemSide / rowSide);
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspectRatio) {
        bestAspectRatio = worstAspect;
        row = candidate;
        rowValue = candidateValue;
      } else {
        break;
      }
    }

    const rowArea = (rowValue / remainingValue) * w * h;
    const rowLength = rowArea / side;

    let offset = 0;
    for (const item of row) {
      const itemFraction = item.value / rowValue;
      const itemLength = itemFraction * side;

      if (isHorizontal) {
        rects.push({
          x: x,
          y: y + offset,
          w: rowLength,
          h: itemLength,
          item,
        });
      } else {
        rects.push({
          x: x + offset,
          y: y,
          w: itemLength,
          h: rowLength,
          item,
        });
      }
      offset += itemLength;
    }

    if (isHorizontal) {
      x += rowLength;
      w -= rowLength;
    } else {
      y += rowLength;
      h -= rowLength;
    }

    remaining = remaining.slice(row.length);
    remainingValue -= rowValue;
    if (remainingValue <= 0) break;
  }

  return rects;
}

const PALETTE = [
  { bg: "rgba(56,189,248,0.18)", border: "rgba(56,189,248,0.35)", text: "#38bdf8" },
  { bg: "rgba(129,140,248,0.18)", border: "rgba(129,140,248,0.35)", text: "#818cf8" },
  { bg: "rgba(52,211,153,0.18)", border: "rgba(52,211,153,0.35)", text: "#34d399" },
  { bg: "rgba(251,191,36,0.16)", border: "rgba(251,191,36,0.32)", text: "#fbbf24" },
  { bg: "rgba(244,114,182,0.16)", border: "rgba(244,114,182,0.32)", text: "#f472b6" },
  { bg: "rgba(167,139,250,0.16)", border: "rgba(167,139,250,0.32)", text: "#a78bfa" },
  { bg: "rgba(45,212,191,0.16)", border: "rgba(45,212,191,0.32)", text: "#2dd4bf" },
  { bg: "rgba(251,146,60,0.16)", border: "rgba(251,146,60,0.32)", text: "#fb923c" },
];

export function KeywordTreemap({ items }: KeywordTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<LayoutRect[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width } = entry.contentRect;
      const height = Math.min(width * 0.55, 380);
      setDimensions({ width, height });
      setRects(squarify(items, width, height));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [items]);

  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ height: dimensions.height || 320 }}
    >
      {rects.map((rect, index) => {
        const color = PALETTE[index % PALETTE.length];
        const sizeRatio = rect.item.value / maxValue;
        const fontSize = Math.max(11, Math.min(22, 11 + sizeRatio * 14));
        const countFontSize = Math.max(9, fontSize - 3);
        const showCount = rect.w > 50 && rect.h > 35;
        const Tag = rect.item.href ? "a" : "div";

        return (
          <Tag
            key={rect.item.text}
            {...(rect.item.href ? { href: rect.item.href } : {})}
            className="absolute flex flex-col items-center justify-center overflow-hidden transition-all duration-200 hover:brightness-125 hover:scale-[1.02] hover:z-10"
            style={{
              left: rect.x + 1.5,
              top: rect.y + 1.5,
              width: Math.max(0, rect.w - 3),
              height: Math.max(0, rect.h - 3),
              backgroundColor: color.bg,
              border: `1px solid ${color.border}`,
              borderRadius: 12,
              cursor: rect.item.href ? "pointer" : "default",
            }}
          >
            <span
              className="truncate px-2 font-bold leading-tight"
              style={{
                fontSize,
                color: color.text,
                maxWidth: "100%",
                textShadow: "0 1px 4px rgba(0,0,0,0.25)",
              }}
            >
              {rect.item.text}
            </span>
            {showCount && (
              <span
                className="mt-0.5 font-medium opacity-60"
                style={{ fontSize: countFontSize, color: color.text }}
              >
                {rect.item.value}회
              </span>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
