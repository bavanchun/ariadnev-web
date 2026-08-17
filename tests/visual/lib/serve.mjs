// Entry-point script for Playwright's `webServer` lifecycle.
//
// Starts both site and docs static servers on their fixed loopback
// ports and stays alive until Playwright sends SIGTERM. One process
// per invocation so port ownership is unambiguous — the parent PID is
// the only owner Playwright needs to kill on teardown.

import { startSiteServer, startDocsServer } from "./servers.mjs";

const site = await startSiteServer();
const docs = await startDocsServer();

// Log the origins so `webServer.url` readiness checks always land on
// something we produced, not stale output from an earlier run.
process.stdout.write(`site ready ${site.origin}\n`);
process.stdout.write(`docs ready ${docs.origin}\n`);

async function shutdown() {
  try {
    await site.close();
  } catch {
    /* best-effort */
  }
  try {
    await docs.close();
  } catch {
    /* best-effort */
  }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
