// Entry program for the make.fun best-game-01 competition (Node 22+, stdlib only).
//
// Copies game/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, or /output by default) and writes
// dossier.json there with buildDossier from vendor/makefun-game.ts.
// Two runs write byte-identical output. Exits non-zero on any error.

import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(import.meta.dirname);
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function copyTree(srcDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  const entries = readdirSync(srcDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const src = join(srcDir, entry.name);
    const dest = join(destDir, entry.name);
    const st = lstatSync(src);
    if (st.isSymbolicLink()) throw new Error(`${src}: symbolic links are not allowed`);
    if (entry.isDirectory()) {
      copyTree(src, dest);
    } else if (entry.isFile()) {
      copyFileSync(src, dest);
    } else {
      throw new Error(`${src}: not a plain file or directory`);
    }
  }
}

function main(): void {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(gameDir) || !lstatSync(gameDir).isDirectory()) throw new Error('game/: no such directory');
  if (!existsSync(shotsDir) || !lstatSync(shotsDir).isDirectory()) throw new Error('screenshots/: no such directory');

  mkdirSync(outputDir, { recursive: true });
  // Start from a clean slate so stale files from an earlier run cannot leak in.
  rmSync(join(outputDir, 'game'), { recursive: true, force: true });
  rmSync(join(outputDir, 'screenshots'), { recursive: true, force: true });

  copyTree(gameDir, join(outputDir, 'game'));
  copyTree(shotsDir, join(outputDir, 'screenshots'));

  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`wrote ${join(outputDir, 'dossier.json')} (${dossier.length} bytes)`);
}

try {
  main();
} catch (err) {
  console.error(`main.ts: ${(err as Error).message}`);
  process.exit(1);
}
