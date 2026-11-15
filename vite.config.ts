import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { serviceWorkerSource } from './src/logic/pwa.ts';
import { formatVersion } from './src/logic/version.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

function gitShortHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? listFiles(join(dir, e.name), root)
      : [relative(root, join(dir, e.name)).replace(/\\/g, '/')],
  );
}

/**
 * 離線快取（T012）：建置完把 dist 裡的檔案列成清單，寫出 dist/sw.js。
 * 程式碼本體在 src/logic/pwa.ts（有單元測試），這裡只負責列檔案與寫檔。
 */
function serviceWorkerPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'wgz-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle() {
      const source = serviceWorkerSource({
        version: formatVersion(pkg.version, gitShortHash()),
        files: listFiles(outDir),
      });
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
}

export default defineConfig({
  plugins: [serviceWorkerPlugin()],
  // 相對路徑：GitHub Pages 子路徑與本機預覽都能用
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_HASH__: JSON.stringify(gitShortHash()),
  },
  build: {
    chunkSizeWarningLimit: 2000, // Phaser 本身約 1.5 MB
  },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/testSetup.ts'],
  },
});
