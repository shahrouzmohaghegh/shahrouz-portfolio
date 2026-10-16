import type { Metadata } from "next";
import type { ReactNode } from "react";

// tokens.css must be imported before breakpoints.css: both set :root at equal specificity.
// reveal.css and focus.css read the tokens, so they come after both, focus.css last
// (scripts/check-tokens.mts asserts the order).
import "@/styles/tokens.css";
import "@/styles/breakpoints.css";
import "@/styles/reveal.css";
import "@/styles/focus.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  // Absolute base for every relative metadata URL, such as the listings' canonical links.
  metadataBase: new URL("https://shahrouzmohaghegh.com"),
  // Each route's own title renders as "<Name> | Shahrouz Mohaghegh"; Home keeps the default.
  title: { default: "Shahrouz Mohaghegh", template: "%s | Shahrouz Mohaghegh" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={styles.body}>{children}</body>
    </html>
  );
}
