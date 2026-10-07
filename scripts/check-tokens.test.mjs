// Tests for check-tokens.mjs. Run with: npm run test:scripts

import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BREAKPOINTS_PATH,
  DESIGN_PATH,
  LAYOUT_PATH,
  TOKENS_PATH,
  checkBreakpoints,
  checkFloor,
  checkLayoutImports,
  checkParity,
  expectedNeutrals,
  expectedRemaps,
  expectedTokens,
  parseDeclarations,
  parseFrontmatter,
  run,
  scanStylesheet,
} from "./check-tokens.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const DESIGN = read(DESIGN_PATH);
const TOKENS_CSS = read(TOKENS_PATH);
const BREAKPOINTS_CSS = read(BREAKPOINTS_PATH);
const LAYOUT = read(LAYOUT_PATH);
const { groups } = parseFrontmatter(DESIGN);
const tokens = parseDeclarations(TOKENS_CSS);
const defined = new Set(Object.keys(tokens));

const MOBILE_ROLES = [
  "display-hero", "figure", "figure-small", "page-title", "section-title", "subsection-title",
  "card-title", "support", "dek", "body-lead", "body", "data-row", "route-link", "wordmark",
  "wordmark-footer", "pull-quote",
];

const fixtures = [];
after(() => fixtures.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// A copy of the repo's token inputs, with `files` overriding or adding paths.
function fixture(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "check-tokens-"));
  fixtures.push(dir);
  for (const path of [DESIGN_PATH, TOKENS_PATH, BREAKPOINTS_PATH, LAYOUT_PATH]) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    cpSync(join(ROOT, path), join(dir, path));
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

const scan = (css) => scanStylesheet("x.module.css", css, defined);

describe("the real repository", () => {
  test("passes", () => {
    const { failures, summary } = run(ROOT);
    assert.deepEqual(failures, []);
    assert.match(summary, /^232 tokens checked/);
  });

  test("every one of the 16 roles has mobile tokens equal to its -mobile entry", () => {
    const props = { fontFamily: "family", fontSize: "size", fontWeight: "weight", lineHeight: "leading", letterSpacing: "tracking" };
    for (const role of MOBILE_ROLES) {
      const entry = groups.typography[`${role}-mobile`];
      assert.ok(entry, `${role}-mobile exists in DESIGN.md`);
      for (const [prop, value] of Object.entries(entry)) {
        const expected = prop === "fontFamily" ? tokens[`--type-${role}-family`] : value;
        assert.equal(tokens[`--type-${role}-mobile-${props[prop]}`], expected, `${role}-mobile ${prop}`);
      }
    }
    const mobileRoles = Object.keys(groups.typography).filter((r) => r.endsWith("-mobile"));
    assert.equal(mobileRoles.length, MOBILE_ROLES.length);
  });

  test("the remap count is exact and derived from DESIGN.md", () => {
    let typeRemaps = 0;
    for (const role of MOBILE_ROLES) typeRemaps += Object.keys(groups.typography[`${role}-mobile`]).length;
    // margin, section, band, hero-plate x2, contact-plate x2, chip padding
    const expected = typeRemaps + 7 + 1;
    assert.equal(expected, 81);
    assert.equal(Object.keys(expectedRemaps(groups)).length, expected);
  });

  test("each of the 16 roles has a size remap to its mobile token inside the 767px media query", () => {
    const remaps = expectedRemaps(groups);
    for (const role of MOBILE_ROLES) {
      assert.equal(remaps[`--type-${role}-size`], `var(--type-${role}-mobile-size)`);
    }
    assert.match(BREAKPOINTS_CSS, /@media \(max-width: 767px\)/);
  });

  test("chip-border is #8E7E68", () => {
    assert.equal(tokens["--color-chip-border"], "#8E7E68");
  });

  test("a composite splits into -width and -height", () => {
    assert.equal(tokens["--space-hero-plate-desktop-width"], "480px");
    assert.equal(tokens["--space-hero-plate-desktop-height"], "372px");
  });
});

describe("parity", () => {
  const expected = expectedTokens(groups);
  const neutrals = expectedNeutrals(groups);

  test("a changed value fails, naming the token and both values", () => {
    const failures = checkParity(expected, neutrals, { ...tokens, "--color-paper": "#FFFFFF" });
    assert.deepEqual(failures, [`${TOKENS_PATH}: --color-paper is #FFFFFF, DESIGN.md says #FBF7F1`]);
  });

  test("a missing token fails", () => {
    const rest = { ...tokens };
    delete rest["--space-stack-xs"];
    const failures = checkParity(expected, neutrals, rest);
    assert.deepEqual(failures, [`${TOKENS_PATH}: --space-stack-xs is missing (DESIGN.md: 8px)`]);
  });

  test("a changed composite half fails", () => {
    const failures = checkParity(expected, neutrals, { ...tokens, "--space-handson-plate-height": "170px" });
    assert.equal(failures.length, 1);
    assert.match(failures[0], /--space-handson-plate-height is 170px/);
  });

  test("a token with no DESIGN.md source fails (reverse parity)", () => {
    for (const name of ["--color-invented", "--font-mono", "--type-x-size", "--radius-pill", "--space-gutter"]) {
      const failures = checkParity(expected, neutrals, { ...tokens, [name]: "1px" });
      assert.deepEqual(failures, [`${TOKENS_PATH}: ${name} has no source in DESIGN.md`]);
    }
  });

  test("a custom property with no known prefix fails", () => {
    const failures = checkParity(expected, neutrals, { ...tokens, "--foo": "#fff" });
    assert.deepEqual(failures, [`${TOKENS_PATH}: --foo has no known token prefix`]);
  });

  test("a neutral spacing token must point at the desktop value", () => {
    const failures = checkParity(expected, neutrals, { ...tokens, "--space-margin": "var(--space-margin-mobile)" });
    assert.equal(failures.length, 1);
    assert.match(failures[0], /--space-margin is var\(--space-margin-mobile\)/);
  });

  test("the CLI fails on drift", () => {
    const dir = fixture({ [TOKENS_PATH]: TOKENS_CSS.replace("#8E7E68", "#C9B9A4") });
    const { failures } = run(dir);
    assert.deepEqual(failures, [`${TOKENS_PATH}: --color-chip-border is #C9B9A4, DESIGN.md says #8E7E68`]);
  });
});

describe("vacuous pass", () => {
  test("an empty parity group fails", () => {
    const { errors } = parseFrontmatter(DESIGN.replace(/^rounded:\n(?: {2}.*\n)+/m, "rounded:\n"));
    assert.ok(errors.includes('DESIGN.md: group "rounded" parsed empty'), errors.join("\n"));
  });

  test("an unknown top-level group fails", () => {
    const { errors } = parseFrontmatter(DESIGN.replace("rounded:\n", "radii:\n  x: 1px\nrounded:\n"));
    assert.ok(errors.some((e) => /unknown top-level group "radii"/.test(e)), errors.join("\n"));
  });

  test("an unparsed entry fails", () => {
    const { errors } = parseFrontmatter(DESIGN.replace("  card-gap: 26px\n", "  card-gap 26px\n"));
    assert.ok(errors.some((e) => /unparsed spacing entry/.test(e)), errors.join("\n"));
  });

  test("an unknown typography property fails", () => {
    const { errors } = parseFrontmatter(DESIGN.replace("    fontSize: 17px\n", "    fontSize: 17px\n    textTransform: none\n"));
    assert.ok(errors.some((e) => /unknown typography property "textTransform"/.test(e)), errors.join("\n"));
  });

  test("a missing frontmatter fails", () => {
    assert.equal(parseFrontmatter("# no frontmatter").errors.length, 1);
  });

  test("the CLI fails rather than passing on an empty group", () => {
    const dir = fixture({ [DESIGN_PATH]: DESIGN.replace(/^colors:\n(?: {2}.*\n)+/m, "colors:\n") });
    assert.ok(run(dir).failures.includes('DESIGN.md: group "colors" parsed empty'));
  });

  test("CRLF line endings parse the same", () => {
    const crlf = parseFrontmatter(DESIGN.replace(/\n/g, "\r\n"));
    assert.deepEqual(crlf.errors, []);
    assert.deepEqual(crlf.groups, groups);
  });

  test("a '#' inside quotes is a value, after whitespace a comment", () => {
    assert.equal(groups.colors.paper, "#FBF7F1");
    const { groups: g } = parseFrontmatter(DESIGN.replace("  card-gap: 26px\n", "  card-gap: 26px  # note\n"));
    assert.equal(g.spacing["card-gap"], "26px");
  });
});

describe("type floor", () => {
  test("the four named exceptions pass", () => {
    assert.deepEqual(checkFloor(tokens), []);
    assert.equal(tokens["--type-stage-number-size"], "10.5px");
  });

  test("any other size under 13.5px fails", () => {
    assert.equal(checkFloor({ ...tokens, "--type-small-size": "13px" }).length, 1);
    assert.equal(checkFloor({ ...tokens, "--type-wordmark-mobile-size": "12px" }).length, 1);
  });

  test("13.5px itself passes", () => {
    assert.deepEqual(checkFloor({ "--type-small-size": "13.5px" }), []);
  });
});

describe("stylesheet scan", () => {
  for (const [label, value] of [
    ["hex", "color: #fff;"],
    ["rgb()", "color: rgb(0 0 0);"],
    ["named colour", "color: white;"],
    ["px", "margin: 12px;"],
    ["rem", "margin: 1rem;"],
    ["em", "padding: 2em;"],
  ]) {
    test(`a literal ${label} fails with file:line`, () => {
      const failures = scan(`.a {\n  display: block;\n  ${value}\n}\n`);
      assert.equal(failures.length, 1, failures.join("\n"));
      assert.match(failures[0], /^x\.module\.css:3: /);
    });
  }

  test("scaled type fails", () => {
    const failures = scan(".a {\n  font-size: calc(var(--type-body-size) * 0.8);\n}");
    assert.ok(failures.some((f) => /^x\.module\.css:2: scaled type token/.test(f)), failures.join("\n"));
  });

  test("an undefined variable fails", () => {
    assert.deepEqual(scan(".a {\n  color: var(--nope);\n}"), ["x.module.css:2: undefined variable --nope"]);
  });

  test("a final declaration without ';' is still scanned", () => {
    assert.deepEqual(scan(".a { color: var(--nope) }"), ["x.module.css:1: undefined variable --nope"]);
    assert.deepEqual(scan(".a { color: var(--color-ink) }"), []);
  });

  test("allowed values pass", () => {
    const css = `.a {
  margin: 0;
  width: 100%;
  opacity: 0.5;
  z-index: 2;
  background: transparent;
  border-color: currentColor;
  color: inherit;
  padding: initial;
  font-size: var(--type-body-size);
  color: var(--color-ink);
  padding: var(--component-capability-chip-padding);
}
.a:hover { color: var(--color-accent); }
`;
    assert.deepEqual(scan(css), []);
  });

  test("a custom property declared in the module itself counts as defined", () => {
    assert.deepEqual(scan(".a { --gap: var(--space-stack-sm); gap: var(--gap); }"), []);
  });

  test("comments are ignored", () => {
    assert.deepEqual(scan("/* color: #fff; 12px */\n.a { color: var(--color-ink); }"), []);
  });

  test("type properties take a token or a CSS-wide keyword", () => {
    for (const decl of ["font-size: smaller", "font-weight: 700", "font-family: serif", "line-height: 1.5",
      "letter-spacing: normal", "font: bold var(--type-body-size) var(--type-body-family)"]) {
      const failures = scan(`.a { ${decl}; }`);
      assert.ok(failures.some((f) => /must be a var\(--type-\*\) token/.test(f)), `${decl}: ${failures}`);
    }
    for (const decl of ["font-size: var(--type-body-size)", "font-weight: inherit", "line-height: revert-layer",
      "letter-spacing: unset", "font-family: initial", "font-size: revert",
      "font: var(--type-body-weight) var(--type-body-size)/var(--type-body-leading) var(--type-body-family)"]) {
      assert.deepEqual(scan(`.a { ${decl}; }`), [], decl);
    }
  });

  test("function names and url() contents are not read as colours", () => {
    assert.deepEqual(scan(".a { rotate: tan(45deg); background-image: url(img/white.png); }"), []);
  });

  test("system colours fail", () => {
    for (const c of ["Canvas", "CanvasText", "LinkText", "AccentColor", "GrayText"]) {
      assert.deepEqual(scan(`.a {\n  color: ${c};\n}`), [`x.module.css:2: named colour "${c}"`], c);
    }
  });

  test("color-mix() and light-dark() fail", () => {
    for (const v of ["color-mix(in srgb, var(--color-ink) 50%, transparent)", "light-dark(var(--color-ink), var(--color-paper))"]) {
      assert.deepEqual(scan(`.a { color: ${v}; }`), ["x.module.css:1: literal colour function"], v);
    }
  });

  for (const [rule, message] of [
    ["@container (min-width: 1px) {\n  .a { color: var(--color-ink); }\n}", "@container"],
    ["@custom-media --narrow (max-width: 767px);", "@custom-media"],
    ['@import "./x.css" screen and (max-width: 767px);', "@import with a media condition"],
  ]) {
    test(`${message} fails outside breakpoints.css`, () => {
      assert.deepEqual(scan(rule), [`x.module.css:1: ${message} belongs only in ${BREAKPOINTS_PATH}`]);
    });
  }

  test("a plain or layered @import passes", () => {
    assert.deepEqual(scan('@import "./x.css";\n@import url(./y.css) layer(base);'), []);
  });

  test("@media fails", () => {
    const failures = scan("@media (max-width: 767px) {\n  .a { color: var(--color-ink); }\n}");
    assert.ok(failures.some((f) => /^x\.module\.css:1: @media/.test(f)), failures.join("\n"));
  });
});

describe("breakpoints.css", () => {
  const remaps = expectedRemaps(groups);
  const check = (css) => checkBreakpoints(css, remaps, tokens);

  test("the real file passes", () => {
    assert.deepEqual(check(BREAKPOINTS_CSS), []);
  });

  test("an extra declaration fails", () => {
    const css = BREAKPOINTS_CSS.replace(":root {\n", ":root {\n    --color-paper: var(--color-deep);\n");
    assert.ok(check(css).some((f) => /--color-paper is not an expected mobile remap/.test(f)));
  });

  test("a literal remap value fails", () => {
    const css = BREAKPOINTS_CSS.replace("var(--type-body-mobile-size)", "16px");
    assert.ok(check(css).some((f) => /--type-body-size is 16px/.test(f)));
  });

  test("a missing remap fails", () => {
    const css = BREAKPOINTS_CSS.replace("    --space-margin: var(--space-margin-mobile);\n", "");
    assert.deepEqual(check(css), [`${BREAKPOINTS_PATH}: missing remap --space-margin: var(--space-margin-mobile)`]);
  });

  test("a final declaration without ';' is accepted", () => {
    const css = BREAKPOINTS_CSS.replace("var(--component-capability-chip-padding-mobile);", "var(--component-capability-chip-padding-mobile)");
    assert.deepEqual(check(css), []);
  });

  test("a rule after the first closing brace fails", () => {
    assert.equal(check(`${BREAKPOINTS_CSS}\n.a { color: red; }\n`).length, 1);
    const twoRoots = BREAKPOINTS_CSS.replace(/\n}\n$/, "\n  :root { --space-band: 1px; }\n}\n");
    assert.equal(check(twoRoots).length, 1);
  });

  test("a different breakpoint fails", () => {
    assert.equal(check(BREAKPOINTS_CSS.replace("767px", "600px")).length, 1);
  });
});

describe("run() over a fixture repository", () => {
  test("@media in a non-module stylesheet fails", () => {
    const dir = fixture({ "app/globals.css": "body { margin: 0; }\n@media (max-width: 767px) {\n  body { margin: 0; }\n}\n" });
    const { failures } = run(dir);
    assert.deepEqual(failures, [`app/globals.css:2: @media belongs only in ${BREAKPOINTS_PATH}`]);
  });

  test("a literal in a non-module stylesheet fails", () => {
    const dir = fixture({ "app/globals.css": "body {\n  color: black;\n}\n" });
    assert.deepEqual(run(dir).failures, ['app/globals.css:2: named colour "black"']);
  });

  test("a clean module passes", () => {
    const dir = fixture({ "components/card.module.css": ".card { padding: var(--space-stack-md); }\n" });
    const { failures, summary } = run(dir);
    assert.deepEqual(failures, []);
    assert.match(summary, /1 other stylesheet/);
  });

  test("a stylesheet under a nested docs/ directory is scanned", () => {
    const dir = fixture({ "app/docs/x.css": "body {\n  color: black;\n}\n" });
    assert.deepEqual(run(dir).failures, ['app/docs/x.css:2: named colour "black"']);
  });

  test("swapped stylesheet imports in app/layout.tsx fail", () => {
    const swapped = LAYOUT.replace('import "@/styles/tokens.css";\nimport "@/styles/breakpoints.css";',
      'import "@/styles/breakpoints.css";\nimport "@/styles/tokens.css";');
    assert.notEqual(swapped, LAYOUT);
    const dir = fixture({ [LAYOUT_PATH]: swapped });
    assert.deepEqual(run(dir).failures,
      [`${LAYOUT_PATH}: must import @/styles/tokens.css before @/styles/breakpoints.css`]);
  });

  test("a missing stylesheet import in app/layout.tsx fails", () => {
    for (const path of ["tokens", "breakpoints"]) {
      const dir = fixture({ [LAYOUT_PATH]: LAYOUT.replace(`import "@/styles/${path}.css";\n`, "") });
      assert.deepEqual(run(dir).failures, [`${LAYOUT_PATH}: must import @/styles/${path}.css`]);
    }
    assert.deepEqual(checkLayoutImports(null), [`${LAYOUT_PATH}: missing`]);
  });

  test("@container in tokens.css fails", () => {
    const dir = fixture({ [TOKENS_PATH]: `${TOKENS_CSS}\n@container (min-width: 1px) { :root { --color-paper: #FBF7F1; } }\n` });
    assert.ok(run(dir).failures.includes(`${TOKENS_PATH}: @container belongs only in ${BREAKPOINTS_PATH}`));
  });

  test("@media in tokens.css fails", () => {
    const dir = fixture({ [TOKENS_PATH]: `${TOKENS_CSS}\n@media print { :root { --color-paper: #FBF7F1; } }\n` });
    assert.ok(run(dir).failures.includes(`${TOKENS_PATH}: @media belongs only in ${BREAKPOINTS_PATH}`));
  });
});
