import type { ReactNode } from "react";

import { SiteFooter } from "./site-footer";
import { SiteHeader, type NavCurrent } from "./site-header";

export type { NavCurrent };

// The frame every route renders (UX-DR28): one header with the primary nav,
// one main, one footer. Each route passes its own nav item as `current`, so
// a detail page can choose its marker instead of inheriting the listing's.
// components/site-frame.test.tsx fails any app/**/page.tsx that skips it.
export function SiteFrame({ current, children }: { current: NavCurrent; children: ReactNode }) {
  return (
    <>
      <SiteHeader current={current} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
