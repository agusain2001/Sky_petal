import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  responsiveAssets,
  responsiveWidths,
} from "../src/lib/responsive-assets";
async function main() {
  const root = path.join(process.cwd(), "public", "images"),
    output = path.join(root, "responsive");
  await mkdir(output, { recursive: true });
  let generated = 0;
  for (const name of responsiveAssets) {
    const source = path.join(root, `${name}.webp`),
      modified = (await stat(source)).mtimeMs;
    for (const width of responsiveWidths) {
      const target = path.join(output, `${name}-${width}.webp`);
      try {
        if ((await stat(target)).mtimeMs >= modified) continue;
      } catch {
        /* Generate the missing responsive asset. */
      }
      await sharp(source)
        .resize({ width })
        .webp({ quality: 75 })
        .toFile(target);
      generated++;
    }
  }
  console.log(`Responsive storefront assets ready (${generated} generated).`);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
