import { defineConfig } from "@playwright/test";
import base from "./recovery.config";
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "recovery-closure.spec.ts",
  timeout: 60000,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          (process.env.QA_EVIDENCE_DIR || "./evidence/recovery") +
          "/closure.json",
      },
    ],
  ],
});
