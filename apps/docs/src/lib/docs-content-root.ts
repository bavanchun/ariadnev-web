import { isAbsolute, resolve } from "node:path";

export const DOCS_CONTENT_ROOT_ENV = "VCSKILL_DOCS_CONTENT_ROOT";

export function resolveDocsContentRoot(appRoot: string, configured = process.env[DOCS_CONTENT_ROOT_ENV]): string {
  if (configured === undefined || configured.length === 0) return resolve(appRoot, "content");
  if (!isAbsolute(configured) || configured.includes("\0")) throw new Error(`${DOCS_CONTENT_ROOT_ENV} must be an absolute local path`);
  return resolve(configured);
}
