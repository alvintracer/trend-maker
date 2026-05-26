export type AdSlotKey =
  | "global_social_bar"
  | "global_popunder"
  | "home_top_banner"
  | "home_left_rail"
  | "home_right_rail"
  | "home_inline_rectangle"
  | "home_bottom_native"
  | "detail_top_banner"
  | "detail_left_rail"
  | "detail_right_rail"
  | "detail_inline_native"
  | "detail_bottom_banner";

type BannerUnit = {
  kind: "banner";
  width: number;
  height: number;
  scriptSrc: string;
  adKey: string;
};

type NativeUnit = {
  kind: "native";
  scriptSrc: string;
  containerId: string;
};

type ScriptUnit = {
  kind: "script";
  scriptSrc: string;
};

export type AdSlotDefinition = {
  key: AdSlotKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
  unit: BannerUnit | NativeUnit | ScriptUnit;
};

export const adSlotDefinitions: AdSlotDefinition[] = [
  {
    key: "global_social_bar",
    label: "Global Social Bar",
    description: "Public page global script shown across main and detail pages.",
    defaultEnabled: true,
    unit: {
      kind: "script",
      scriptSrc:
        "https://pl29561635.effectivecpmnetwork.com/1c/95/00/1c95006f303d8d7f60c88d83cef58fca.js",
    },
  },
  {
    key: "global_popunder",
    label: "Global Popunder",
    description: "Public page global popunder script.",
    defaultEnabled: false,
    unit: {
      kind: "script",
      scriptSrc:
        "https://pl29561633.effectivecpmnetwork.com/df/e1/ba/dfe1badbfb955e91002fbe4f2055b0d6.js",
    },
  },
  {
    key: "home_top_banner",
    label: "Home Top Banner",
    description: "728x90 desktop and 320x50 mobile leaderboard above the trend board.",
    defaultEnabled: true,
    unit: {
      kind: "banner",
      width: 728,
      height: 90,
      adKey: "9d5c27f2898c6bfad3402a06b45d3b4c",
      scriptSrc:
        "https://www.highperformanceformat.com/9d5c27f2898c6bfad3402a06b45d3b4c/invoke.js",
    },
  },
  {
    key: "home_left_rail",
    label: "Home Left Rail",
    description: "160x600 rail banner on the left side of the homepage.",
    defaultEnabled: true,
    unit: {
      kind: "banner",
      width: 160,
      height: 600,
      adKey: "4c45c5f7ad3ce48a00270e6b0b8dce37",
      scriptSrc:
        "https://www.highperformanceformat.com/4c45c5f7ad3ce48a00270e6b0b8dce37/invoke.js",
    },
  },
  {
    key: "home_right_rail",
    label: "Home Right Rail",
    description: "160x600 rail banner on the right side of the homepage.",
    defaultEnabled: true,
    unit: {
      kind: "banner",
      width: 160,
      height: 600,
      adKey: "4c45c5f7ad3ce48a00270e6b0b8dce37",
      scriptSrc:
        "https://www.highperformanceformat.com/4c45c5f7ad3ce48a00270e6b0b8dce37/invoke.js",
    },
  },
  {
    key: "home_inline_rectangle",
    label: "Home Inline Rectangle",
    description: "300x250 rectangle inserted inside the homepage board area.",
    defaultEnabled: true,
    unit: {
      kind: "banner",
      width: 300,
      height: 250,
      adKey: "5c8d7a684f91ed9f5ad403634d895264",
      scriptSrc:
        "https://www.highperformanceformat.com/5c8d7a684f91ed9f5ad403634d895264/invoke.js",
    },
  },
  {
    key: "home_bottom_native",
    label: "Home Bottom Native",
    description: "Native banner below the homepage trend sections.",
    defaultEnabled: true,
    unit: {
      kind: "native",
      scriptSrc:
        "https://pl29561632.effectivecpmnetwork.com/177624ffdd1056d695164d7b6a8e418b/invoke.js",
      containerId: "container-177624ffdd1056d695164d7b6a8e418b",
    },
  },
  {
    key: "detail_top_banner",
    label: "Detail Top Banner",
    description: "728x90 top banner for keyword detail pages.",
    defaultEnabled: true,
    unit: {
      kind: "banner",
      width: 728,
      height: 90,
      adKey: "9d5c27f2898c6bfad3402a06b45d3b4c",
      scriptSrc:
        "https://www.highperformanceformat.com/9d5c27f2898c6bfad3402a06b45d3b4c/invoke.js",
    },
  },
  {
    key: "detail_left_rail",
    label: "Detail Left Rail",
    description: "160x600 left rail on keyword detail pages.",
    defaultEnabled: true,
    unit: {
      kind: "banner",
      width: 160,
      height: 600,
      adKey: "4c45c5f7ad3ce48a00270e6b0b8dce37",
      scriptSrc:
        "https://www.highperformanceformat.com/4c45c5f7ad3ce48a00270e6b0b8dce37/invoke.js",
    },
  },
  {
    key: "detail_right_rail",
    label: "Detail Right Rail",
    description: "300x250 right rail on keyword detail pages.",
    defaultEnabled: true,
    unit: {
      kind: "banner",
      width: 300,
      height: 250,
      adKey: "5c8d7a684f91ed9f5ad403634d895264",
      scriptSrc:
        "https://www.highperformanceformat.com/5c8d7a684f91ed9f5ad403634d895264/invoke.js",
    },
  },
  {
    key: "detail_inline_native",
    label: "Detail Inline Native",
    description: "Native banner between detail content sections.",
    defaultEnabled: true,
    unit: {
      kind: "native",
      scriptSrc:
        "https://pl29561632.effectivecpmnetwork.com/177624ffdd1056d695164d7b6a8e418b/invoke.js",
      containerId: "container-177624ffdd1056d695164d7b6a8e418b",
    },
  },
  {
    key: "detail_bottom_banner",
    label: "Detail Bottom Banner",
    description: "468x60 bottom banner for keyword detail pages.",
    defaultEnabled: true,
    unit: {
      kind: "banner",
      width: 468,
      height: 60,
      adKey: "6a67f84b8387d9209680147f55da25ab",
      scriptSrc:
        "https://www.highperformanceformat.com/6a67f84b8387d9209680147f55da25ab/invoke.js",
    },
  },
];

export const adSlotDefinitionMap = new Map(adSlotDefinitions.map((slot) => [slot.key, slot]));

export function getAdSlotDefinition(slotKey: AdSlotKey) {
  const slot = adSlotDefinitionMap.get(slotKey);

  if (!slot) {
    throw new Error(`Unknown ad slot: ${slotKey}`);
  }

  return slot;
}
