import type { Metadata } from "next";
import type { ReactNode } from "react";

// tokens.css must be imported before breakpoints.css: both set :root at equal specificity.
import "@/styles/tokens.css";
import "@/styles/breakpoints.css";

export const metadata: Metadata = {
  title: "Shahrouz Mohaghegh",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
