import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { chromium } from "@playwright/test";
if (!process.env.LIGHTHOUSE_CLI || !process.env.CHROME_PATH)
  throw new Error(
    "Set LIGHTHOUSE_CLI to an installed Lighthouse CLI and CHROME_PATH to a local Chromium/Edge executable.",
  );
const out = path.resolve(
  "qa/evidence/recovery/lighthouse-" +
    new Date().toISOString().replace(/[:.]/g, "-"),
);
await mkdir(out, { recursive: true });
const db = await mkdtemp(path.join(os.tmpdir(), "sky-petal-performance-"));
const socket = net.createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  DATABASE_URL: "",
  DATABASE_DIR: db,
  SKY_PETAL_BUILD_DIR: ".next-recovery",
  NEXT_PUBLIC_SITE_URL: base,
  SITE_INDEXING_ENABLED: "false",
  DEPLOYMENT_ENV: "staging",
  ALLOW_LOCAL_AUTH: "false",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  RAZORPAY_KEY_ID: "",
  RAZORPAY_KEY_SECRET: "",
  RAZORPAY_WEBHOOK_SECRET: "",
  SHIPROCKET_TOKEN: "",
  SHIPROCKET_EMAIL: "",
  SHIPROCKET_PASSWORD: "",
  COURIER_WEBHOOK_TOKEN: "",
  COMMERCE_MAINTENANCE_SECRET: "",
};
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (chunk) => (logs += chunk));
const summaries = [];
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/api/me")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Isolated performance server unavailable");
  for (const [name, route, desktop] of [
    ["home-mobile", "/", false],
    ["shop-mobile", "/shop", false],
    ["pdp-mobile", "/products/the-petal-bralette", false],
    ["home-desktop", "/", true],
  ]) {
    const debugSocket = net.createServer();
    await new Promise((resolve) => debugSocket.listen(0, "127.0.0.1", resolve));
    const debugPort = debugSocket.address().port;
    await new Promise((resolve) => debugSocket.close(resolve));
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH,
      headless: true,
      args: ["--remote-debugging-port=" + debugPort],
    });
    const output = path.join(out, name + ".json");
    const args = [
      process.env.LIGHTHOUSE_CLI,
      base + route,
      "--port=" + debugPort,
      "--hostname=127.0.0.1",
      "--only-categories=performance",
      "--output=json",
      "--output-path=" + output,
      "--quiet",
      ...(desktop ? ["--preset=desktop"] : []),
    ];
    const started = new Date().toISOString();
    const child = spawn(process.execPath, args, {
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (chunk) => (log += chunk));
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    await browser.close();
    await writeFile(path.join(out, name + ".txt"), log);
    if (code !== 0) throw new Error(name + " Lighthouse failed: " + log);
    const result = JSON.parse(await readFile(output, "utf8"));
    const summary = {
      name,
      started,
      finished: new Date().toISOString(),
      command: [process.execPath, ...args].join(" "),
      lighthouseVersion: result.lighthouseVersion,
      fetchTime: result.fetchTime,
      score: result.categories.performance.score,
      lcp_ms: result.audits["largest-contentful-paint"].numericValue,
      cls: result.audits["cumulative-layout-shift"].numericValue,
      tbt_ms: result.audits["total-blocking-time"].numericValue,
      scope:
        "One simulated lab navigation on a clean local production build/PGlite; no field p75/INP/device or staging certification",
      warnings: result.runWarnings,
    };
    summaries.push(summary);
    await writeFile(
      path.join(out, "summary.json"),
      JSON.stringify(summaries, null, 2),
    );
    console.log(JSON.stringify(summary));
  }
} finally {
  server.kill();
  await new Promise((resolve) => server.once("exit", resolve));
  await writeFile(path.join(out, "server.txt"), logs);
}
