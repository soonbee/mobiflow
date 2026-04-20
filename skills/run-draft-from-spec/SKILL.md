---
name: run-draft-from-spec
description: spec 문서를 기반으로 정적 UI 시안을 생성하는 draft phase의 단일 세그먼트 플레이북. ui-design·design-tokens가 Lock된 후 docs/ui-drafts/ 트리를 빌드하고 화면별 스크린샷을 캡처한다. /nidost:run-draft-from-spec으로 직접 실행하거나 spec-ui-design 완료 시 lifecycle 안내를 통해 진입한다.
---

# run-draft-from-spec

draft phase의 단일 세그먼트 플레이북. spec 문서(ui-design.md, design-tokens.md)를 기반으로 `docs/ui-drafts/` 트리를 빌드하고 리뷰 통과 후 화면별 스크린샷을 캡처한다.

오케스트레이터는 이 문서의 단계를 순서대로 따르며, 각 단계에서 지정된 서브에이전트를 호출한다.

---

## 사전 체크 (STEP 0)

### 0-1. 필수 선행 문서 존재 및 Lock 확인

`docs/ui-design/ui-design.md`와 `docs/design-tokens/design-tokens.md`가 모두 존재하고 Lock 상태여야 한다.

```bash
for CAT in ui-design design-tokens; do
  test -f docs/${CAT}/${CAT}.md || { echo "❌ docs/${CAT}/${CAT}.md 없음"; exit 1; }
  VERSION=$(awk '/^version:/ {print $2; exit}' docs/${CAT}/${CAT}.md)
  git tag --list "doc/${CAT}/v${VERSION}" | grep -q . && echo "${CAT}: locked v${VERSION}" || echo "${CAT}: working v${VERSION}"
done
```

- 둘 다 Lock 아님 → 사용자에게 안내 후 종료:
  > ⚠️ `{카테고리}`가 Working 상태입니다. draft 작성 전 `/nidost:spec-lock {카테고리}`로 Lock하는 것을 권장합니다.
  >
  > 1. 지금 Lock
  > 2. Working 상태 그대로 진행 (재현성 약화)
  > 3. 종료
- 파일 자체가 없으면 종료. spec phase 완료를 먼저 권유

추출한 버전을 `{UI_DESIGN_VERSION}`, `{DT_VERSION}`로 보관.

### 0-2. ui-design.md §0 범위 선언 점검

ui-design.md 본문 상단에 `## 0. 범위 선언`이 있고 "이 프로젝트에서는 사용자 인터페이스가 해당 없음" 류의 A2형 스킵이 명시되면 종료:

> ℹ️ 이 프로젝트는 ui-design.md §0에 따라 시각 UI를 갖지 않습니다. draft phase는 해당 없음.

§0이 있지만 재해석된 인터페이스(CLI 명령 트리, API 문서 페이지 등)가 명시된 경우는 그대로 진행한다. 시안은 그 인터페이스를 정적 HTML로 시각화한다.

### 0-3. 기존 ui-drafts/ 상태 분기

```bash
test -d docs/ui-drafts
```

- **없음 → 신규 빌드**: STEP 1로 진행
- **있음 + 통합 태그 `draft/v*` 없음 (Working)**:
  > ℹ️ `docs/ui-drafts/`가 Working 상태입니다.
  >
  > 1. 이어서 갱신 (특정 화면만 재빌드)
  > 2. 전체 재빌드 (덮어씀)
  > 3. 종료
- **있음 + Lock 태그 존재**:
  > ⚠️ `docs/ui-drafts/`가 Lock 상태입니다 ({기존 태그}).
  >
  > 1. 새 버전 작성 (덮어쓰며 새 Working 진입)
  > 2. 종료

선택 1·2에 따라 빌드 범위를 결정.

### 0-4. 캡처 뷰포트 결정

STEP 4(스크린샷 캡처)가 사용할 뷰포트 목록을 결정한다. 결정 결과는 오케스트레이터 메모리에 보관하고, STEP 1 빌드 프롬프트와 STEP 4 캡처 입력에 동일하게 전달된다.

#### 결정 우선순위

1. **갱신 모드**: 기존 `_shared/aesthetic.md` frontmatter에 `viewports:` 배열이 있으면 그대로 재사용 (이후 단계에서 임의 변경 금지 — 일관성 깨짐)
2. **신규 빌드**: 아래 신호를 순차 검사
   - `docs/ui-design/ui-design.md` frontmatter 또는 §0의 `platform:` 필드 (`mobile` | `web` | `both`)
   - `docs/design-tokens/design-tokens.md`의 브레이크포인트 토큰 (예: `--bp-mobile`, `--bp-tablet`, `--bp-desktop`)
   - ui-design.md §3 화면 명세 본문의 viewport 힌트 (예: "390 기준", "responsive desktop")
3. 신호 부재 → 사용자 확인 프롬프트:
   > 캡처 뷰포트 신호를 spec 문서에서 찾지 못했습니다. 기본값으로 진행할까요?
   >
   > 1. 모바일 단일 (390×844)
   > 2. 데스크톱 단일 (1440×900)
   > 3. 모바일+데스크톱 페어
   > 4. 직접 입력 (이름·너비·높이)

#### 결정 결과 형식

```yaml
viewports:
  - { name: mobile,  width: 390,  height: 844 }
  - { name: desktop, width: 1440, height: 900 }
```

- 단일 뷰포트: 캡처 파일명에서 viewport name 생략 (`screenshots/default.png`)
- 멀티 뷰포트: `screenshots/default.{name}.png` 형식

이 값은 STEP 1 호출 프롬프트에 전달되어 `_shared/aesthetic.md` frontmatter `viewports:`에 기록되며, STEP 4 캡처 단계에서 다시 읽어 사용한다.

---

## STEP 1 — Stage 1: 공통 자산 빌드 (직렬, 1회)

서브에이전트 `eng-ui-draft`를 1회 호출하여 `docs/ui-drafts/_shared/`를 빌드한다.

- **보유 스킬**: frontend-design, with-ui-spec, dev-ui-draft
- **호출 모드**: Stage 1 (`_shared/`만 빌드)
- **입력**: `docs/ui-design/ui-design.md`, `docs/design-tokens/design-tokens.md`
- **수행 내용**:
  - `_shared/tokens.css` — design-tokens → CSS 변수 평탄화
  - `_shared/aesthetic.md` — 7개 섹션(큰 방향·색 분포·공간 리듬·타이포 위계·모서리·모션·금지 목록)
  - `_shared/partials/` — ui-design.md §2 내비게이션을 보고 구조 partial(header/tabbar/footer/sidebar/모달 컨테이너) 생성. 각 partial과 동명 `.css` 함께 생성
  - `_shared/includer.js` — `dev-ui-draft`의 30줄 레퍼런스 구현 그대로
- **출력**: `docs/ui-drafts/_shared/` 트리

호출 프롬프트에 다음 명시:
- "Stage 1 — Shared Assets only. Do not touch any SCR-xxx directory."
- 입력 문서 경로
- 산출 디렉토리 경로
- "프로젝트가 갱신 모드(0-3 선택 1)인 경우 기존 _shared/는 보존하고 누락분만 보충"
- "`_shared/aesthetic.md` frontmatter에 `viewports:` 배열을 포함할 것 — 값은 다음 YAML을 그대로 사용: {STEP 0-4에서 결정된 viewports YAML}"
- "`_shared/INDEX.html`은 STEP 5에서 생성하므로 Stage 1에서 건드리지 말 것"

---

## STEP 2 — Stage 2: 화면별 빌드 (병렬)

ui-design.md §1 화면 목록을 파싱해 빌드 대상 SCR-xxx 목록을 만든다.

- 신규 빌드: 전체 화면
- 갱신(특정 화면만 재빌드): 사용자 지정 SCR 또는 직전 STEP 3 강한 판정에서 적출된 SCR
- 전체 재빌드: 전체 화면

각 SCR-xxx마다 `eng-ui-draft`를 **병렬 호출**한다.

- **보유 스킬**: frontend-design, with-ui-spec, dev-ui-draft
- **호출 모드**: Stage 2 (단일 SCR-xxx)
- **입력 (각 호출에 동일하게 전달)**:
  - 자기 화면의 ui-design.md §3 명세 (해당 화면 부분만)
  - `_shared/` 경로 (모든 자산 참조)
  - design-tokens.md 경로 (필요 시 직접 참조)
- **수행 내용**:
  - `docs/ui-drafts/SCR-xxx/{index.html, style.css, script.js?, notes.md, variants/?}` 생성
  - 헤더·탭바 등 구조 partial은 `data-include`로만 참조
  - 명세에 정의된 모든 UI 요소·상태 시연 가능하게 구현
- **출력**: `docs/ui-drafts/SCR-xxx/` 트리

병렬 호출 시 각 에이전트는 자기 SCR 디렉토리 외에는 어떤 파일도 수정하지 않는다 (eng-ui-draft 본문에 명시됨).

병렬 호출이 모두 완료되면 STEP 3로 진행.

---

## STEP 3 — 리뷰 (1회)

서브에이전트 `reviewer-ui-draft`를 1회 호출한다.

- **보유 스킬**: review-ui-draft
- **모델**: sonnet
- **입력**: `docs/ui-drafts/` 전체 + `docs/ui-design/ui-design.md` + `docs/design-tokens/design-tokens.md`
- **수행 내용**:
  - 4구역 출력 (수정 필요 / 권장 / 통과 / 평론 노트)
- **출력**: 검수 보고서

스크린샷은 이 단계의 입력이 아니다 (시각 검증 별도 처리하지 않음).

---

## 루프 분기

STEP 3 결과의 **수정 필요 (🔴)** 항목을 분석해 다음 분기 중 하나를 선택한다.

### 분기 A: 수정 필요 없음

- 종료 조건 만족 → STEP 4 (스크린샷 캡처)로 진행

### 분기 B: 수정 필요 항목이 특정 화면(들)에만 있음

- 영향 범위: 해당 SCR-xxx만
- 복귀 단계: STEP 2 (해당 화면들만 병렬 재호출)
- 컨텍스트: 강한 판정 항목을 해당 SCR의 `eng-ui-draft` 호출 프롬프트에 전달
- 재실행 후 STEP 3 재수행

### 분기 C: 수정 필요 항목이 _shared 변경을 요구

다음 중 하나라도 해당:
- `_shared/tokens.css` 누락·오류
- `_shared/aesthetic.md` 7개 섹션 누락
- 구조 partial 누락 또는 일관성 결함
- includer.js 누락

대응:
- 영향 범위: 전체
- 복귀 단계: STEP 1 → STEP 2 (전체 화면) → STEP 3
- 컨텍스트: 강한 판정 항목을 Stage 1 `eng-ui-draft` 프롬프트에 전달

### 권장 (🟡)·평론 노트 (📝)

자동 재빌드 트리거가 아니다. STEP 5 완료 보고에 그대로 포함하여 사용자에게 전달.

### 루프 상한

- 분기 B와 C 합산 최대 **3회**
- 상한 초과 시 잔여 강한 판정 항목과 평론 노트를 사용자에게 보고하고 수동 판단을 요청

---

## STEP 4 — 화면 스크린샷 캡처

리뷰 통과(분기 A) 직후 1회 실행. 리뷰가 PNG에 의존하지 않으므로 캡처 실패가 리뷰를 차단하지 않는다. 캡처 매트릭스는 항상 전체 화면 × 전체 variants × STEP 0-4 viewports의 카르테시안 곱.

### 4-1. 캡처 도구 준비

`docs/ui-drafts/_shared/_tools/`에 아래 3개 파일이 없으면 레퍼런스 그대로 생성한다 (갱신 시 보존). `includer.js`와 동일한 "정전 코드, 그대로 사용" 원칙.

#### capture.mjs (레퍼런스 구현)

`_shared/aesthetic.md` frontmatter의 `viewports:`를 읽고 `SCR-*/index.html` + 각 `variants/*.html`을 순회하며 캡처한다. `data-include` 인클루더의 fetch 완료는 `networkidle`로 대기.

```js
// _shared/_tools/capture.mjs
//
// Usage:
//   node capture.mjs --base-url <url> --shots-root <path> [--scr SCR-xxx,SCR-yyy]
//
// 출력: <shots-root>/SCR-xxx/screenshots/{stem}.png
//      또는 멀티 뷰포트일 때 {stem}.{viewport-name}.png
// stdout: ok|fail\t<scr>/<rel> @ <viewport>\t-> <결과>

import { chromium } from 'playwright';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

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
        console.log(`ok\t${t.scr}/${t.relPath} @ ${vp.name}\t-> ${r.outPath}`);
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
  const fileName = single ? `${t.stem}.png` : `${t.stem}.${vp.name}.png`;
  const outPath = join(root, t.scr, 'screenshots', fileName);
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: outPath, fullPage: true });
    return { ok: true, outPath };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  } finally {
    await ctx.close();
  }
}
```

#### package.json

```json
{
  "name": "ui-drafts-capture",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "preview": "http-server ../.. -p 8765 -o /_shared/INDEX.html -c-1"
  },
  "dependencies": {
    "playwright": "^1.50.0"
  },
  "devDependencies": {
    "http-server": "^14.1.1"
  }
}
```

`npm run preview`는 `docs/ui-drafts/`를 루트로 한 HTTP 서버를 띄우고 브라우저로 `_shared/INDEX.html`을 자동으로 연다.

#### .gitignore

```
node_modules/
```

#### 의존성 설치 (1회 또는 누락 시)

```bash
cd docs/ui-drafts/_shared/_tools
npm install
npx playwright install chromium
```

설치 단계 실패 시 STEP 4 전체 skip + 사용자 안내. 빌드+리뷰 산출물은 캡처 없이도 유효.

### 4-2. HTTP 서버 기동

`data-include` partial 인클루더가 `file://`에서 동작하지 않으므로 정적 HTTP 서버를 임시 기동한다.

```bash
cd docs/ui-drafts && python3 -m http.server 8765 >/tmp/ui-drafts-http.log 2>&1 &
SERVER_PID=$!
sleep 1
```

캡처 종료 후 항상 `kill $SERVER_PID` (오류 발생 시에도 trap으로 보장).

### 4-3. 캡처 실행

```bash
node docs/ui-drafts/_shared/_tools/capture.mjs \
  --base-url http://localhost:8765 \
  --shots-root docs/ui-drafts
```

리뷰 통과 후이므로 부분 캡처 의미 없음 → 항상 전체 캡처. (사용자가 lifecycle에서 "캡처만 재시도" 선택 시에도 전체 재캡처)

### 4-4. 결과 수집

스크립트 stdout을 파싱해 ok/fail 수를 집계. 실패 항목은 화면 ID·variant·viewport·원인을 표로 보관해 STEP 5-4 완료 요약과 5-5 lifecycle 프롬프트에 반영한다.

캡처 실패는 산출물 결함이지 빌드 결함이 아니다. 사용자가 재시도 또는 무시를 선택할 수 있도록 정보만 제공하고 자동 재빌드 트리거로 사용하지 않는다.

---

## STEP 5 — 완료 보고 및 산출물 정리

### 5-1. 메타 문서 생성

INDEX.md(사람 검토용 마크다운)와 INDEX.html(브라우저 갤러리 진입점)을 둘 다 생성한다.

#### 5-1-a. INDEX.md 작성/갱신

`docs/ui-drafts/INDEX.md` 생성:

```markdown
# UI Drafts Index

| 화면 ID | 디렉토리 | 변형 수 | 스크린샷 | 비고 |
| --- | --- | --- | --- | --- |
| SCR-001 | [SCR-001/](SCR-001/) | 0 | [📷](SCR-001/screenshots/) | 랜딩 |
| SCR-002 | [SCR-002/](SCR-002/) | 1 | [📷](SCR-002/screenshots/) | variants/admin.html |

## 공통 자산
- [_shared/tokens.css](_shared/tokens.css)
- [_shared/aesthetic.md](_shared/aesthetic.md)
- [_shared/partials/](_shared/partials/)
- [_shared/INDEX.html](_shared/INDEX.html) — 브라우저 갤러리 진입점
- [_shared/_tools/capture.mjs](_shared/_tools/capture.mjs)

## 캡처 뷰포트
- mobile  390×844
- desktop 1440×900

## 검토 방법
브라우저 갤러리 (권장):
~~~bash
cd docs/ui-drafts/_shared/_tools && npm run preview
~~~
또는 무설치:
~~~bash
cd docs/ui-drafts && python3 -m http.server 8765
~~~
→ http://localhost:8765/_shared/INDEX.html

스크린샷만 다시 만들고 싶으면:
~~~bash
node docs/ui-drafts/_shared/_tools/capture.mjs \
  --base-url http://localhost:8765 \
  --shots-root docs/ui-drafts
~~~
```

(위 마크다운 본문 안의 `~~~`는 INDEX.md에 쓸 때 ` ``` `로 교체한다 — 본 SKILL.md 안에서 펜스 충돌을 피하려는 표기일 뿐.)

캡처가 일부/전부 실패한 화면은 스크린샷 셀에 `⚠️` 마커를 추가한다.

#### 5-1-b. INDEX.html 생성/재생성

`docs/ui-drafts/_shared/INDEX.html`을 매 STEP 5마다 재생성(덮어쓰기)한다. `includer.js`·`capture.mjs`와 동일한 "정전 코드" 원칙 — 아래 템플릿의 placeholder만 동적으로 치환.

**입력 파싱**:
- `ui-design.md` §1 → 화면 ID 목록 + 제목 (`{SCR}`, `{TITLE}` 자리)
- `_shared/aesthetic.md` frontmatter `viewports:` → 첫 viewport가 썸네일 기본값(`{THUMB_VP}`), 헤더 표시(`{VP_LIST}`)
- 각 `SCR-xxx/variants/*.html` 스캔 → variant 링크
- 단일 뷰포트면 PNG 파일명에서 `.{viewport}` 생략 (capture.mjs와 동일 규칙)

**카드 nav 링크 규칙**:
- `open` (index.html)
- variant 각각 (있으면)
- viewport별 PNG 직링크

**경로**: 절대 경로(`/SCR-xxx/...`) 사용 — 서버 루트 = `docs/ui-drafts/` 전제

**템플릿** (그대로 사용, `{}`만 치환):

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>UI Drafts {VERSION} Preview</title>
  <style>
    :root {
      --bg: #fafafa; --card-bg: #fff; --border: #e5e5e5;
      --text: #1a1a1a; --muted: #666; --accent: #0a66c2;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px; background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header { margin-bottom: 24px; }
    header h1 { margin: 0 0 4px; font-size: 20px; }
    header p { margin: 0; color: var(--muted); font-size: 13px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .card {
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;
    }
    .card a.thumb {
      display: block; aspect-ratio: 9 / 16; background: #f0f0f0;
      border-bottom: 1px solid var(--border);
    }
    .card a.thumb img {
      width: 100%; height: 100%; object-fit: cover; object-position: top; display: block;
    }
    .card .body { padding: 12px 14px; }
    .card h2 { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
    .card p { margin: 0 0 8px; font-size: 12px; color: var(--muted); }
    .card nav { display: flex; gap: 8px; flex-wrap: wrap; }
    .card nav a {
      font-size: 12px; color: var(--accent); text-decoration: none;
      padding: 2px 6px; border: 1px solid var(--border); border-radius: 4px;
    }
    .card nav a:hover {
      background: var(--accent); color: #fff; border-color: var(--accent);
    }
  </style>
</head>
<body>
  <header>
    <h1>UI Drafts {VERSION} Preview</h1>
    <p>viewports: {VP_LIST}</p>
  </header>
  <main class="grid">
    {SCR_CARDS}
  </main>
</body>
</html>
```

**카드 1개 템플릿** (`{SCR_CARDS}` 자리에 SCR마다 1번 반복):

```html
<article class="card">
  <a class="thumb" href="/{SCR}/index.html">
    <img src="/{SCR}/screenshots/default{.THUMB_VP}.png" alt="{SCR}">
  </a>
  <div class="body">
    <h2>{SCR} · {TITLE}</h2>
    <p>{VARIANT_COUNT} variants</p>
    <nav>
      <a href="/{SCR}/index.html">open</a>
      {VARIANT_LINKS}
      {VIEWPORT_PNG_LINKS}
    </nav>
  </div>
</article>
```

- `{.THUMB_VP}`는 멀티 뷰포트일 때만 `.{이름}`을 넣고, 단일 뷰포트면 빈 문자열
- `{VARIANT_LINKS}`: `<a href="/{SCR}/variants/{stem}.html">{stem}</a>` 반복
- `{VIEWPORT_PNG_LINKS}`: viewport마다 `<a href="/{SCR}/screenshots/default.{vp}.png">{vp}.png</a>` (단일 뷰포트면 `default.png` 1개)
- 캡처 실패한 (SCR, viewport)는 해당 PNG 링크에 `⚠️` 접두 추가

### 5-2. CHANGELOG.md 작성/갱신

```markdown
# UI Drafts Changelog

## 0.1.0 ({YYYY-MM-DD})
- 초안 작성 (ui-design v{UI_DESIGN_VERSION}, design-tokens v{DT_VERSION} 기반)
- 화면 N개, 공통 partial M개
- 스크린샷 K장 ({viewport 목록}; 실패 F건)
```

갱신인 경우 새 항목 추가.

### 5-3. _shared/aesthetic.md frontmatter

`_shared/aesthetic.md` 최상단에 frontmatter:

```yaml
---
title: UI Drafts Aesthetic
version: 0.1.0
based_on:
  - ui-design@{UI_DESIGN_VERSION}
  - design-tokens@{DT_VERSION}
viewports:
  - { name: mobile,  width: 390,  height: 844 }
  - { name: desktop, width: 1440, height: 900 }
created: {YYYY-MM-DD}
updated: {YYYY-MM-DD}
---
```

`viewports:`는 STEP 1 Stage 1 호출 시 이미 기록되어 있어야 한다. 본 단계에서는 `version`·`updated` 필드만 갱신하며, `viewports`는 변경하지 않는다 (변경하면 기존 캡처와 일관성 깨짐 — 변경이 필요하면 다음 버전에서).

이 frontmatter가 통합 Lock 태그(`draft/v0.1.0`)의 버전 기준이 된다.

### 5-4. 완료 요약 출력

```
✅ UI Drafts v0.1.0 작성 완료

  공통 자산:    docs/ui-drafts/_shared/
  화면 시안:    docs/ui-drafts/SCR-xxx/ × N개
  스크린샷:     K장 성공 / F건 실패  (viewports: mobile, desktop)
  INDEX:        docs/ui-drafts/INDEX.md
  CHANGELOG:    docs/ui-drafts/CHANGELOG.md

  기준 ui-design:    v{UI_DESIGN_VERSION}
  기준 design-tokens: v{DT_VERSION}

  강한 판정: 0건 | 권장: N건 | 평론 노트: N건

검토 방법:
  cd docs/ui-drafts/_shared/_tools && npm run preview
  (또는 cd docs/ui-drafts && python3 -m http.server 8765
   → http://localhost:8765/_shared/INDEX.html)

다음 phase: dev (dev-segment-router로 진입)
```

권장·평론 노트가 있으면 요약 아래에 그대로 인용. 캡처 실패가 있으면 실패 표(화면·variant·viewport·원인)도 함께 출력.

### 5-5. Lifecycle 프롬프트

기본:
> draft phase가 완료되었습니다.
>
> 1. Lock (`git commit` + `git tag draft/v{VERSION}`)
> 2. Working 상태 유지 (추가 화면 작성 또는 수동 편집 예정)
> 3. dev phase로 바로 진입 (`/nidost:run-app-ui-from-draft` 또는 dev-segment-router)

캡처 실패 F>0인 경우 옵션 추가:
> 4. 캡처만 재시도 (build/review는 건드리지 않고 STEP 4만 다시 실행)

선택 1: commit + tag 안내. 직접 수행하지 않고 사용자에게 위임 (spec-lock 패턴과 동일).
선택 4: STEP 4-2~4-4만 재실행.

---

## 주의사항

- Stage 2 병렬 호출 시 각 에이전트가 자기 SCR 외 파일을 절대 수정하지 않도록 프롬프트에 명시
- 갱신 모드에서 기존 `_shared/`를 함부로 덮어쓰지 않음 — 누락분만 보충 (capture.mjs 포함)
- 평론 노트는 자동 재빌드 트리거가 아님 (사람 판단 게이트)
- 본 스킬은 Lock(commit + tag)을 직접 수행하지 않는다. 사용자 또는 별도 명령에 위임
- 캡처는 리뷰 후에만 수행한다 — 루프 B/C 사이클 동안 캡처를 발생시키지 않아 비용을 아끼고, 최종 산출물(=리뷰 통과 상태)의 스냅샷만 보장
- `data-include` 때문에 캡처 시 `file://` 직접 열기 금지 — HTTP 서버 경유 필수
- `_shared/aesthetic.md` frontmatter의 `viewports:`는 갱신 시 재캡처 일관성을 보장하는 키 — 같은 draft 버전 내에서는 변경 금지. 변경하려면 새 버전을 끊을 것
- Playwright 미설치 환경에서는 STEP 4를 skip하고 사용자에게 안내. 빌드+리뷰 산출물은 캡처 없이도 유효한 산출물로 본다
- `_shared/INDEX.html`은 STEP 5마다 자동 재생성된다 — 수동 편집은 덮어쓰임. 레이아웃 커스터마이즈가 필요하면 `_shared/preview-custom.html` 같은 별도 파일로 작성
- `_shared/INDEX.html`은 절대 경로(`/SCR-xxx/...`)를 사용하므로 HTTP 서버 루트가 `docs/ui-drafts/`여야 한다 (preview 스크립트와 python3 http.server 안내 모두 이 루트 전제)
- 캡처 미실행/실패 시 `_shared/INDEX.html`의 썸네일은 깨진 아이콘으로 표시된다 (정상 — 산출물 결함 아님)
