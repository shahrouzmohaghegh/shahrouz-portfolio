import type { Metadata } from "next";
import type { ReactNode } from "react";

// tokens.css must be imported before breakpoints.css: both set :root at equal specificity.
// reveal.css and focus.css read the tokens, so they come after both, focus.css last
// (scripts/check-tokens.mts asserts the order).
import "@/styles/tokens.css";
import "@/styles/breakpoints.css";
import "@/styles/reveal.css";
import "@/styles/focus.css";
import { site } from "@/content/site";
import { personJson } from "@/lib/structured-data";
import styles from "./layout.module.css";

// The link preview defaults, set once here (Story 5.6). They carry no title
// or description: Next.js fills og:title, og:description and the Twitter
// card's from each route's own title and description, so a pasted link
// previews with that page's words. The image is app/opengraph-image.tsx,
// which Next.js adds to the Open Graph and Twitter tags of every route.
export const metadata: Metadata = {
  // Absolute base for every relative metadata URL, such as the listings' canonical links.
  metadataBase: new URL(site.url),
  // Each route's own title renders as "<Name> | Shahrouz Mohaghegh"; Home keeps the default.
  title: { default: site.name, template: `%s | ${site.name}` },
  openGraph: { type: "website", siteName: site.name, locale: "en_AU" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personJson() }} />
        {children}
      </body>
    </html>
  );
}
