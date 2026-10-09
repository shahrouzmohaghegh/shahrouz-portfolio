// Standing check for AD-6: if the rule stops firing, this directive is unused and lint fails.
// eslint-disable-next-line import/no-restricted-paths
import type { caseStudies } from "@/content/case-studies";

export type ProbeCaseStudies = typeof caseStudies;
