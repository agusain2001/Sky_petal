/** HTTP scheduler: shares the running application's DB instead of opening a
 * second PGlite process. No provider credentials are required by this worker. */
import { setTimeout as wait } from "node:timers/promises";

async function main() {
  const target = new URL(
    process.env.COMMERCE_MAINTENANCE_URL ||
      "http://127.0.0.1:4317/api/internal/maintenance",
  );
  const secret = process.env.COMMERCE_MAINTENANCE_SECRET || "";
  if (secret.length < 32)
    throw new Error(
      "Configure the same maintenance secret (at least 32 characters) on the application and worker",
    );
  if (
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== "/api/internal/maintenance"
  )
    throw new Error(
      "Maintenance URL must identify the application maintenance endpoint without credentials or query parameters",
    );
  if (
    target.protocol !== "https:" &&
    !(
      target.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
    )
  )
    throw new Error(
      "Use HTTPS for remote maintenance; plain HTTP is permitted only on loopback",
    );
  const interval = Number(
    process.env.COMMERCE_MAINTENANCE_INTERVAL_MS || 60000,
  );
  if (!Number.isInteger(interval) || interval < 1000 || interval > 3600000)
    throw new Error("Maintenance interval must be between 1000 and 3600000 ms");
  const shutdown = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => shutdown.abort());
  while (!shutdown.signal.aborted) {
    try {
      const response = await fetch(target, {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(300000)]),
      });
      if (!response.ok)
        throw new Error(`Maintenance returned HTTP ${response.status}`);
      const result = await response.json();
      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          status: "completed",
          expired: result.expired,
          processed: result.processed,
          failed: result.failed,
          payments: result.payments,
          jobs: result.jobs,
        }),
      );
    } catch {
      if (!shutdown.signal.aborted)
        console.error(
          JSON.stringify({
            at: new Date().toISOString(),
            status: "failed",
            message:
              "Maintenance did not complete; inspect application health and recovery queues",
          }),
        );
    }
    try {
      await wait(interval, undefined, { signal: shutdown.signal });
    } catch {
      break;
    }
  }
}
main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
