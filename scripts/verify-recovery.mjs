/** Local-only acceptance runner. Credentials stay in OS temporary storage,
 * provider settings are cleared, and existing screenshots are restored. */
import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  cp,
  readFile,
  writeFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
const root = process.cwd(),
  campaign = path.join(root, "qa", "evidence", "recovery");
const out = path.join(
  campaign,
  "run-" + new Date().toISOString().replace(/[:.]/g, "-"),
);
await mkdir(out, { recursive: true });
await writeFile(
  path.join(campaign, "latest-run.json"),
  JSON.stringify({ directory: path.relative(root, out) }, null, 2),
);
const reused = process.env.RECOVERY_REUSE_FIXTURES;
if (
  reused &&
  (!path.resolve(reused).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(reused).startsWith("sky-petal-acceptance-recovery-"))
)
  throw new Error(
    "Fixture reuse requires an explicitly selected synthetic recovery store in OS temporary storage.",
  );
const temp =
  reused ||
  (await mkdtemp(path.join(os.tmpdir(), "sky-petal-acceptance-recovery-")));
const env = {
  ...process.env,
  DATABASE_URL: "",
  DATABASE_DIR: path.join(temp, "sky-petal-acceptance-store"),
  TEST_OWNER_ACCESS_FILE: path.join(temp, "access.json"),
  TEST_COMMERCE_FIXTURES: "true",
  ALLOW_LOCAL_AUTH: "true",
  STAFF_MFA_REQUIRED: "false",
  MFA_ENCRYPTION_KEY: "",
  SKY_PETAL_BUILD_DIR: ".next-recovery",
  SITE_INDEXING_ENABLED: "false",
  DEPLOYMENT_ENV: "staging",
  QA_EVIDENCE_DIR: out,
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
delete env.TEST_BASE_URL;
const commands = [];
async function run(name, args, allowFailure = false) {
  const started = new Date().toISOString();
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  await writeFile(path.join(out, name + ".txt"), output);
  commands.push({
    command: [process.execPath, ...args]
      .map((a) =>
        a === env.TEST_OWNER_ACCESS_FILE ? "[temporary credential file]" : a,
      )
      .join(" "),
    started,
    finished: new Date().toISOString(),
    exit_code: code,
    status: code === 0 ? "PASS" : "FAIL",
    evidence: name + ".txt",
  });
  await writeFile(
    path.join(out, "commands.json"),
    JSON.stringify(commands, null, 2),
  );
  if (code !== 0 && !allowFailure)
    throw new Error(`${name} failed with exit ${code}`);
}
const tsx = "node_modules/tsx/dist/cli.mjs",
  next = "node_modules/next/dist/bin/next",
  playwright = "node_modules/@playwright/test/cli.js";
let server;
const artifactRoot = path.join(root, "artifacts"),
  backup = path.join(temp, "original-artifacts");
await cp(artifactRoot, backup, { recursive: true });
async function files(dir, prefix = "") {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory())
      result.push(...(await files(path.join(dir, entry.name), relative)));
    else result.push(relative);
  }
  return result;
}
const originals = await files(backup);
try {
  if (process.env.RECOVERY_SKIP_BASELINE !== "true") {
    await run("responsive-assets", [tsx, "scripts/prepare-images.ts"]);
    await run("node-tests-final", [
      tsx,
      "--test",
      ...(await readdir("tests"))
        .filter((f) => f.endsWith(".test.ts"))
        .map((f) => "tests/" + f),
    ]);
    await run("typecheck-final", [
      "node_modules/typescript/bin/tsc",
      "--noEmit",
      "--incremental",
      "false",
    ]);
    await run("build-final", [next, "build"]);
  }
  if (!reused) {
    await run("fixtures", [tsx, "scripts/prepare-acceptance.ts"]);
    await run("qa-fixtures", [tsx, "qa/prepare-fixtures.ts"]);
  }
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  env.TEST_BASE_URL = `http://127.0.0.1:${port}`;
  env.NEXT_PUBLIC_SITE_URL = env.TEST_BASE_URL;
  let serverOutput = "";
  server = spawn(
    process.execPath,
    [next, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => {
      serverOutput += chunk;
    });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(env.TEST_BASE_URL + "/api/me")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Isolated server did not become ready");
  if (process.env.RECOVERY_CLOSURE_ONLY !== "true") {
    await run("http-probes", [tsx, "qa/http-probes.ts"], true);
    await run("normalize-fixture", [tsx, "qa/normalize-baseline-fixture.ts"]);
    await run(
      "api-tests",
      [tsx, "--test", "tests/api.test.ts", "tests/admin.test.ts"],
      true,
    );
    await run(
      "browser",
      [playwright, "test", "--config", "qa/recovery.config.ts"],
      true,
    );
    await run(
      "browser-audit",
      [playwright, "test", "--config", "qa/recovery-audit.config.ts"],
      true,
    );
    await run("performance", [tsx, "qa/performance.ts"], true);
  }
  await run(
    "closure",
    [playwright, "test", "--config", "qa/recovery-closure.config.ts"],
    true,
  );
  await writeFile(path.join(out, "server.txt"), serverOutput);
  await writeFile(
    path.join(out, "environment.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base: env.TEST_BASE_URL,
        database: "New isolated OS-temp PGlite store",
        credentials: "Synthetic, retained only in OS-temp access.json",
        provider_calls: "Disabled",
        build: ".next-recovery",
        staging: false,
      },
      null,
      2,
    ),
  );
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
  }
  // Preserve newly generated evidence, then restore every pre-existing image.
  await mkdir(path.join(out, "screenshots"), { recursive: true });
  for (const file of originals) {
    const original = await readFile(path.join(backup, file));
    const current = await readFile(path.join(artifactRoot, file));
    if (!original.equals(current)) {
      await mkdir(path.dirname(path.join(out, "screenshots", file)), {
        recursive: true,
      });
      await cp(
        path.join(artifactRoot, file),
        path.join(out, "screenshots", file),
      );
      await cp(path.join(backup, file), path.join(artifactRoot, file));
    }
  }
  await writeFile(
    path.join(out, "commands.json"),
    JSON.stringify(commands, null, 2),
  );
}
if (commands.some((c) => c.exit_code !== 0)) process.exitCode = 1;
