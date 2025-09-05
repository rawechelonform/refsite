// updatetagslist.mjs
import fs from "node:fs/promises";
import path from "node:path";

const dir = path.resolve("girlsroom/tags");
const out = path.join(dir, "tags.json");

const entries = await fs.readdir(dir, { withFileTypes: true });

const files = entries
  .filter((e) => e.isFile())
  .map((e) => e.name.normalize("NFC"))
  .filter((n) => /\.(png|jpe?g|webp|gif)$/i.test(n))
  .sort((a, b) => a.localeCompare(b, "en"));

await fs.writeFile(out, JSON.stringify(files, null, 2) + "\n", "utf8");
console.log(`wrote ${files.length} items to ${out}`);
