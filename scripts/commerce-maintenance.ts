import { getDB } from "../src/lib/db";
import { runCommerceMaintenance } from "../src/lib/payment-inbox";
async function main() {
  try {
    console.log(JSON.stringify(await runCommerceMaintenance()));
  } finally {
    await (await getDB()).close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
