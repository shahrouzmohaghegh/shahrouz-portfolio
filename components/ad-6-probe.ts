// Standing check for AD-6: if the rule stops firing, a directive is unused and lint fails.
// One probe per evidence collection, so a typo in either zone path is caught.
// eslint-disable-next-line import/no-restricted-paths
import type { caseStudies } from "@/content/case-studies";
// eslint-disable-next-line import/no-restricted-paths
import type { projects } from "@/content/projects";

export type ProbeCaseStudies = typeof caseStudies;
export type ProbeProjects = typeof projects;
