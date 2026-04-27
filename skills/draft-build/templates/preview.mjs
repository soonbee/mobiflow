// _shared/_tools/preview.mjs
//
// http-server 래퍼. 8765부터 1씩 올려 빈 포트로 띄운다.
//
// flags:
//   --no-open            브라우저 자동 오픈 안 함 (기본: 오픈함)
//   --port-file <path>   바인딩한 포트를 파일에 기록 (캡처 orchestrator가 읽음)
//
// usage:
//   node preview.mjs                                          # make preview
//   node preview.mjs --no-open --port-file /tmp/x.port        # 캡처 백그라운드

import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const open = !args['no-open'];
const portFile = typeof args['port-file'] === 'string' ? args['port-file'] : null;

const START_PORT = 8765;
const MAX_TRIES = 20;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..', '..');
const OPEN_PATH = '/_shared/INDEX.html';

if (portFile) {
  try { unlinkSync(portFile); } catch {}
}

const port = await findFreePort(START_PORT, MAX_TRIES);
if (port !== START_PORT) {
  process.stderr.write(`port ${START_PORT} 사용 중 → ${port}로 대체\n`);
}
if (portFile) writeFileSync(portFile, String(port));

const binDir = resolve(SCRIPT_DIR, 'node_modules', '.bin');
const sep = process.platform === 'win32' ? ';' : ':';
const env = {
  ...process.env,
  PATH: `${binDir}${sep}${process.env.PATH || ''}`,
};

const hsArgs = [ROOT, '-p', String(port), '-c-1'];
if (open) hsArgs.push('-o', OPEN_PATH);

const child = spawn('http-server', hsArgs, {
  stdio: 'inherit',
  cwd: SCRIPT_DIR,
  env,
  shell: process.platform === 'win32',
});

const forward = (sig) => {
  if (child.pid && !child.killed) child.kill(sig);
};
process.on('SIGTERM', () => forward('SIGTERM'));
process.on('SIGINT', () => forward('SIGINT'));

child.on('exit', (code) => process.exit(code ?? 0));

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

async function findFreePort(start, tries) {
  for (let p = start; p < start + tries; p++) {
    if (await isFree(p)) return p;
  }
  throw new Error(`free port not found in range ${start}-${start + tries - 1}`);
}

function isFree(port) {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}
