"use client";

import React, { useState, useEffect, useRef } from "react";

export function ResponsiveAdWrapper({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const clientWidth = containerRef.current.getBoundingClientRect().width;
        // Cap the measured width at the viewport width minus safe page margins (32px)
        // to prevent parent containers from stretching due to CSS flex/grid auto-sizing.
        const viewportWidth = window.innerWidth - 32;
        const availableWidth = Math.min(clientWidth > 0 ? clientWidth : width, viewportWidth);

        if (availableWidth < width) {
          setScale(availableWidth / width);
        } else {
          setScale(1);
        }
      }
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    const timer = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, [width]);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-full flex items-center justify-center overflow-hidden"
      style={{
        height: height * scale,
        transition: "height 0.15s ease-out",
      }}
    >
      <div
        style={{
          width: width,
          height: height,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
