import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  // AD-10: content is data. It imports nothing from components/ or app/.
  // Import paths are resolved, so the @/ alias and any relative path are
  // caught alike.
  {
    files: ["content/**"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./content",
              from: ["./components", "./app"],
              message: "content/ must not import from components/ or app/ (AD-10).",
            },
          ],
        },
      ],
    },
  },
  // AD-6: routes and components read evidence only through lib/evidence.ts,
  // never from the evidence collections or the type leaf directly, so they
  // never see CaseStudy or Project. AD-6 is about evidence: site-wide copy
  // such as content/site.ts is outside the zone and imported directly.
  {
    files: ["app/**", "components/**"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: ["./app", "./components"],
              from: ["./content/case-studies", "./content/projects", "./lib/evidence-types.ts"],
              message:
                "app/ and components/ read evidence through lib/evidence.ts, never from content/case-studies, content/projects or lib/evidence-types.ts (AD-6).",
            },
          ],
        },
      ],
    },
  },
  // AD-21: abandoned-work markers in comments are lint errors, on every
  // branch. The markers are listed only here, so documentation never trips
  // the rule. scripts/lint-rules.test.mts keeps it from being weakened.
  {
    rules: {
      "no-warning-comments": [
        "error",
        { terms: ["todo", "fixme", "xxx", "hack"], location: "anywhere" },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
