import { ImageResponse } from "next/og";

import { site } from "@/content/site";
import { tokenColour } from "@/lib/token-colour";

// The link preview image (Story 5.6), generated at build: his name over the
// positioning line, on the paper ground, in ink, with an accent rule. No
// photograph, so no camera or image-tool metadata can reach it. Next.js adds
// it to the Open Graph and Twitter tags of every route. The colours are read
// from styles/tokens.css, where every design value lives.

export const alt = site.previewAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const paper = tokenColour("paper");
  const ink = tokenColour("ink");
  const muted = tokenColour("muted");
  const accent = tokenColour("accent");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: paper,
          color: ink,
        }}
      >
        <div style={{ width: 96, height: 6, background: accent, marginBottom: 40 }} />
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.02em" }}>{site.name}</div>
        <div style={{ fontSize: 38, lineHeight: 1.3, marginTop: 28, color: muted, maxWidth: 960 }}>{site.positioning}</div>
        <div style={{ fontSize: 26, marginTop: 48, color: muted }}>{site.url.replace(/^https:\/\//, "")}</div>
      </div>
    ),
    size,
  );
}
