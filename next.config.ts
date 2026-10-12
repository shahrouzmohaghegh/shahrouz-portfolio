import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

// MDX through @next/mdx (AD-5): each Evidence Item's prose is a sibling
// <slug>.mdx, imported by lib/evidence.ts and compiled at build. No remark or
// rehype plugin yet; any added later is named as a string, which Turbopack
// needs because it cannot pass functions to the loader.
const withMDX = createMDX({});

export default withMDX(nextConfig);
