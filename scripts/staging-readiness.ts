async function main() {
  const target = new URL(
      process.env.READINESS_URL ||
        "http://127.0.0.1:4317/api/internal/readiness",
    ),
    secret = process.env.COMMERCE_MAINTENANCE_SECRET || "";
  if (secret.length < 32)
    throw Error(
      "Configure the server maintenance secret before this read-only check",
    );
  if (
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== "/api/internal/readiness" ||
    (target.protocol !== "https:" &&
      !(
        target.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
      ))
  )
    throw Error(
      "Use the readiness endpoint over HTTPS or loopback HTTP, without URL credentials or query parameters",
    );
  const response = await fetch(target, {
    headers: { Authorization: `Bearer ${secret}` },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw Error(`Readiness check returned HTTP ${response.status}`);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
  if (data.release_decision !== "GO") process.exitCode = 2;
}
main().catch(() => {
  console.error(
    "Readiness check could not complete. Check server access and configuration; no acceptance has been inferred.",
  );
  process.exitCode = 1;
});
