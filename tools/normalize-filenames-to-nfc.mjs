// tools/normalize-filenames-to-nfc.mjs
import fs from "node:fs/promises";
import path from "node:path";

const dir = path.resolve("girlsroom/tags");

const safeTemp = (p) => {
  const { dir: d, name, ext } = path.parse(p);
  return path.join(d, `${name}.tmp_____${Date.now()}${ext}`);
};

const entries = await fs.readdir(dir, { withFileTypes: true });

for (const ent of entries) {
  if (!ent.isFile()) continue;
  const oldName = ent.name;
  const nfcName = oldName.normalize("NFC");
  if (oldName === nfcName) continue;

  const oldPath = path.join(dir, oldName);
  const newPath = path.join(dir, nfcName);

  try {
    if (newPath !== oldPath) {
      const tempPath = safeTemp(newPath);
      await fs.rename(oldPath, tempPath);
      await fs.rename(tempPath, newPath);
      console.log(`renamed -> ${oldName}  ⟶  ${nfcName}`);
    }
  } catch (e) {
    console.error(`rename failed for ${oldName} -> ${nfcName}`, e);
  }
}
