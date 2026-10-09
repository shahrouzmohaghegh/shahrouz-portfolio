import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";

import { isEntryPoint } from "./entry-point.mts";

const dir = mkdtempSync(join(tmpdir(), "entry-point-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const script = join(dir, "script.mts");
const other = join(dir, "other.mts");
writeFileSync(script, "");
writeFileSync(other, "");
const link = join(dir, "link.mts");
symlinkSync(script, link);
const url = pathToFileURL(script).href;

describe("isEntryPoint", () => {
  test("the script itself is the entry point", () => {
    assert.equal(isEntryPoint(url, script), true);
  });

  test("a symlink to the script is the entry point", () => {
    assert.equal(isEntryPoint(url, link), true);
  });

  test("another file is not", () => {
    assert.equal(isEntryPoint(url, other), false);
  });

  test("no argv[1] is not", () => {
    assert.equal(isEntryPoint(url, undefined), false);
  });

  test("an unresolvable path falls back to the plain comparison instead of skipping", () => {
    const missing = join(dir, "missing.mts");
    assert.equal(isEntryPoint(pathToFileURL(missing).href, missing), true);
    assert.equal(isEntryPoint(url, missing), false);
  });
});
