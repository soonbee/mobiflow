// _shared/_tools/capture.mjs
//
// Usage:
//   node capture.mjs --base-url <url> --shots-root <path> [--scr SCR-xxx,SCR-yyy]
//
// 출력: <shots-root>/SCR-xxx/screenshots/
//   {stem}.png              - 뷰포트 샷 (항상, 단일 뷰포트)
//   {stem}.{vp}.png         - 뷰포트 샷 (멀티 뷰포트)
//   {stem}.full.png         - 풀 샷 (ratio>1.1일 때만, 단일 뷰포트). ratio>5면 5× 컷
//   {stem}.full.{vp}.png    - 풀 샷 (ratio>1.1일 때만, 멀티 뷰포트). ratio>5면 5× 컷
// stdout: ok|fail\t<scr>/<rel> @ <viewport>\tratio=<r>\tfull=<none|full|truncated>\t-> <viewport-path>[, <full-path>]

import { chromium } from 'playwright';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const SCROLL_RATIO_THRESHOLD = 1.1;
const FULL_SHOT_HEIGHT_MULTIPLIER = 5;

const args = parseArgs(process.argv.slice(2));
if (!args['base-url'] || !args['shots-root']) {
  console.error('Usage: node capture.mjs --base-url <url> --shots-root <path> [--scr SCR-xxx,...]');
  process.exit(2);
}
const baseUrl = args['base-url'].replace(/\/$/, '');
const shotsRoot = args['shots-root'];
const scrFilter = args.scr ? new Set(args.scr.split(',')) : null;

const viewports = await readViewports(join(shotsRoot, '_shared', 'aesthetic.md'));
if (viewports.length === 0) {
  console.error('FATAL: no viewports in _shared/aesthetic.md frontmatter');
  process.exit(2);
}
const single = viewports.length === 1;

const targets = await collectTargets(shotsRoot, scrFilter);
if (targets.length === 0) {
  console.error('FATAL: no SCR-xxx targets');
  process.exit(2);
}

const browser = await chromium.launch();
let ok = 0, fail = 0;
try {
  for (const t of targets) {
    await mkdir(join(shotsRoot, t.scr, 'screenshots'), { recursive: true });
    for (const vp of viewports) {
      const r = await captureOne(browser, t, vp, baseUrl, shotsRoot, single);
      if (r.ok) {
        const extra = r.fullPath ? `, ${r.fullPath}` : '';
        console.log(
          `ok\t${t.scr}/${t.relPath} @ ${vp.name}\tratio=${r.ratio.toFixed(2)}\tfull=${r.fullKind}\t-> ${r.viewportPath}${extra}`
        );
        ok++;
      } else {
        console.log(`fail\t${t.scr}/${t.relPath} @ ${vp.name}\t-> ${r.error}`);
        fail++;
      }
    }
  }
} finally {
  await browser.close();
}
console.error(`\nSUMMARY: ${ok} ok, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = argv[i + 1];
    if (v && !v.startsWith('--')) { out[k] = v; i++; } else { out[k] = true; }
  }
  return out;
}

async function readViewports(path) {
  const text = await readFile(path, 'utf8');
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return [];
  const block = fm[1].match(/^viewports:\s*\n((?:\s*-\s*\{[^}]+\}\s*\n?)+)/m);
  if (!block) return [];
  const out = [];
  for (const line of block[1].split('\n')) {
    const m = line.match(/\{([^}]+)\}/);
    if (!m) continue;
    const obj = {};
    for (const pair of m[1].split(',')) {
      const [k, v] = pair.split(':').map(s => s.trim());
      obj[k] = isNaN(Number(v)) ? v : Number(v);
    }
    if (obj.name && obj.width && obj.height) out.push(obj);
  }
  return out;
}

async function collectTargets(root, filter) {
  const entries = await readdir(root, { withFileTypes: true });
  const scrs = entries
    .filter(e => e.isDirectory() && /^SCR-/.test(e.name))
    .map(e => e.name)
    .filter(n => !filter || filter.has(n))
    .sort();
  const out = [];
  for (const scr of scrs) {
    if (existsSync(join(root, scr, 'index.html'))) {
      out.push({ scr, relPath: 'index.html', stem: 'default' });
    }
    const vd = join(root, scr, 'variants');
    if (existsSync(vd)) {
      for (const v of (await readdir(vd)).sort()) {
        if (extname(v) === '.html') {
          out.push({ scr, relPath: `variants/${v}`, stem: basename(v, '.html') });
        }
      }
    }
  }
  return out;
}

async function captureOne(browser, t, vp, baseUrl, root, single) {
  const url = `${baseUrl}/${t.scr}/${t.relPath}`;
  const vpSuffix = single ? '' : `.${vp.name}`;
  const viewportPath = join(root, t.scr, 'screenshots', `${t.stem}${vpSuffix}.png`);
  const fullPath = join(root, t.scr, 'screenshots', `${t.stem}.full${vpSuffix}.png`);
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    const ratio = await page.evaluate(
      (vpHeight) => document.documentElement.scrollHeight / vpHeight,
      vp.height
    );
    await page.screenshot({ path: viewportPath, fullPage: false });
    let fullKind = 'none';
    let writtenFullPath = null;
    if (ratio > SCROLL_RATIO_THRESHOLD) {
      if (ratio <= FULL_SHOT_HEIGHT_MULTIPLIER) {
        await page.screenshot({ path: fullPath, fullPage: true });
        fullKind = 'full';
      } else {
        await page.screenshot({
          path: fullPath,
          clip: { x: 0, y: 0, width: vp.width, height: vp.height * FULL_SHOT_HEIGHT_MULTIPLIER },
        });
        fullKind = 'truncated';
      }
      writtenFullPath = fullPath;
    }
    return { ok: true, viewportPath, fullPath: writtenFullPath, ratio, fullKind };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    await ctx.close();
  }
}
