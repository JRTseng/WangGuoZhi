import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

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

export default defineConfig({
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
  },
});
