// Standing check for AD-10: if the rule stops firing, this directive is unused and lint fails.
// eslint-disable-next-line import/no-restricted-paths
import type RootLayout from "@/app/layout";

export type ProbeLayout = typeof RootLayout;
