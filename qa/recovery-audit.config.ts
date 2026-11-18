import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
const evidence = process.env.QA_EVIDENCE_DIR || "./qa/evidence/recovery";
export default defineConfig({
  ...base,
  outputDir: evidence + "/audit-results",
  reporter: [["list"], ["json", { outputFile: evidence + "/audit.json" }]],
});
