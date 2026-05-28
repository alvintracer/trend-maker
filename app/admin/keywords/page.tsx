import type { Metadata } from "next";

import { KeywordsInventoryPage } from "@/app/keywords/page";

export const metadata: Metadata = {
  title: "Admin Keywords",
  robots: {
    index: false,
    follow: false,
  },
};

export default KeywordsInventoryPage;
