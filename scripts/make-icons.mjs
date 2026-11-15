// 從 public/icons/icon.svg 產生各種尺寸的 App 圖示（T012）。
// 改了圖示以後跑：node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const dir = new URL('../public/icons/', import.meta.url);
const svg = readFileSync(new URL('icon.svg', dir), 'utf-8');

// scale：圖案佔畫面的比例。maskable 會被系統裁成圓形或圓角，圖案要縮在中間的安全範圍內
const targets = [
  { file: 'icon-192.png', size: 192, scale: 1.12 },
  { file: 'icon-512.png', size: 512, scale: 1.12 },
  { file: 'maskable-512.png', size: 512, scale: 0.86 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1.12 },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  const scaled = svg.replace(
    '<g id="dog">',
    `<g id="dog" transform="translate(256 262) scale(${t.scale}) translate(-256 -262)">`,
  );
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${scaled}`,
  );
  await page.screenshot({ path: new URL(t.file, dir).pathname });
  await page.close();
  console.log(t.file);
}
await browser.close();
