#!/usr/bin/env node
/**
 * prepare_media_assets.mjs — Copy đúng file nhạc nền (BGM) + hiệu ứng âm thanh (SFX)
 * mà script.json cần, từ thư viện dùng chung (remotion/assets-library) vào
 * <project>/workspace/{music,sfx}/ để Remotion serve qua staticFile().
 *
 * Chỉ copy những file THẬT SỰ được tham chiếu (script.music + slide[].sfx),
 * không copy nguyên thư viện — tránh workspace phình to vô ích.
 *
 * Usage: node scripts/prepare_media_assets.mjs <project_dir>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIBRARY = path.join(KIT_ROOT, "remotion", "assets-library");

function copyIfExists(srcDir, name, ext, destDir) {
  const src = path.join(srcDir, `${name}${ext}`);
  if (!fs.existsSync(src)) {
    console.warn(`  cảnh báo: không tìm thấy "${name}${ext}" trong thư viện (${srcDir})`);
    return false;
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, `${name}${ext}`));
  return true;
}

function main() {
  const project = process.argv[2];
  if (!project) {
    console.error("usage: prepare_media_assets.mjs <project_dir>");
    process.exit(1);
  }

  const scriptPath = path.join(project, "script.json");
  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  const workspace = path.join(project, "workspace");

  let count = 0;

  if (script.music) {
    const ok = copyIfExists(path.join(LIBRARY, "music"), script.music, ".mp3", path.join(workspace, "music"));
    if (ok) { console.log(`BGM: ${script.music}.mp3`); count++; }
  }

  const sfxNames = new Set(
    (script.slides ?? []).map((s) => s.sfx).filter(Boolean)
  );
  for (const name of sfxNames) {
    const ok = copyIfExists(path.join(LIBRARY, "sfx"), name, ".wav", path.join(workspace, "sfx"));
    if (ok) { console.log(`SFX: ${name}.wav`); count++; }
  }

  console.log(`-> đã chuẩn bị ${count} file media vào ${workspace}`);
}

main();
