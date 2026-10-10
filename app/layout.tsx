import type { Metadata } from "next";
import type { ReactNode } from "react";

// tokens.css must be imported before breakpoints.css: both set :root at equal specificity.
import "@/styles/tokens.css";
import "@/styles/breakpoints.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  // Each route's own title renders as "<Name> | Shahrouz Mohaghegh"; Home keeps the default.
  title: { default: "Shahrouz Mohaghegh", template: "%s | Shahrouz Mohaghegh" },
  // Keeps the placeholder out of search results; removed when the real Home ships (decided by Shahrouz).
  robots: { index: false, follow: false },
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
