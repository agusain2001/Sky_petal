import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
const evidence = process.env.QA_EVIDENCE_DIR || "./qa/evidence/recovery";
export default defineConfig({
  ...base,
  testDir: "../e2e",
  outputDir: evidence + "/browser-results",
  reporter: [["list"], ["json", { outputFile: evidence + "/browser.json" }]],
  use: { ...base.use, trace: "off" },
});
