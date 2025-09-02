// Run with: node updatetagslist.mjs
// Purpose: regenerate bathroom/tags/tags.json
// so your bathroom page knows about all stickers

import { readdir, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const DIR = "bathroom/tags";
const OUT = `${DIR}/tags.json`;

// Which file types to include in the list
const exts = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]);

async function main() {
  const files = (await readdir(DIR, { withFileTypes: true }))
    .filter(d => d.isFile() && exts.has(extname(d.name).toLowerCase()))
    .map(d => d.name)
    .sort((a, b) => a.localeCompare(b));

  await writeFile(OUT, JSON.stringify(files, null, 2));
  console.log(`✅ Updated tags list: wrote ${files.length} entries to ${OUT}`);
}

main().catch(err => {
  console.error("❌ Error updating tags list:", err);
});
