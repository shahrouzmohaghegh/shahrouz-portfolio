// Standing check on the abandoned-work marker rule in eslint.config.mjs:
// deleting or weakening it fails here. Run with: npm run test:scripts
//
// The marker words are assembled from fragments so this file carries none.

import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARKERS = ["TO" + "DO", "FIX" + "ME", "X" + "XX", "HA" + "CK"];
const eslint = new ESLint({ cwd: ROOT });

async function markerErrors(text: string): Promise<number> {
  const [result] = await eslint.lintText(text, { filePath: join(ROOT, "app/probe.tsx") });
  return result.messages.filter((m) => m.ruleId === "no-warning-comments" && m.severity === 2).length;
}

describe("no-warning-comments", () => {
  for (const marker of MARKERS) {
    test(`${marker.toLowerCase()} at the start of a comment is an error`, async () => {
      assert.equal(await markerErrors(`// ${marker} finish this\nexport const a = 1;\n`), 1);
    });
    test(`${marker.toLowerCase()} in the middle of a comment is an error`, async () => {
      assert.equal(await markerErrors(`/* still needs ${marker.toLowerCase()} work */\nexport const a = 1;\n`), 1);
    });
  }

  test("a comment without a marker is clean", async () => {
    assert.equal(await markerErrors("// a plain comment\nexport const a = 1;\n"), 0);
  });
});
