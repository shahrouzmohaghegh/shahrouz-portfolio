// Whether a module is the script Node was asked to run, so a script can be
// both imported by its tests and run directly. Real paths are compared, so a
// symlinked invocation still counts. If a path cannot be resolved, the plain
// comparison decides, so an unresolvable path never makes a check skip itself.

import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export function isEntryPoint(moduleUrl: string, argv1: string | undefined = process.argv[1]): boolean {
  if (argv1 === undefined) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return pathToFileURL(argv1).href === moduleUrl;
  }
}
