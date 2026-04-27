---
name: expo-sdk55-unistyles-stack
description: Scaffold the Expo SDK 55 + Unistyles v3 mobile app at the path defined in `docs/project.config.yaml` `repo.scopes.<scope>.path` (matched by `runtime: react-native-expo` + `framework: expo`). Requires `docs/project.config.yaml` with `repo.scopes.*` populated. Overlays opinionated stack files (ESLint 9 flat config + eslint-config-prettier, Prettier 3, expo-dev-client, smoke:min / smoke scripts, web target disabled — Tier 3) and runs identity substitution. Triggered only by explicit `/nidost:expo-sdk55-unistyles-stack` slash command — not auto-invoked by natural language.
disable-model-invocation: true
---

# Expo RN Stack scaffolder

Deterministic scaffold for an opinionated Expo SDK 55 stack. Pins **Expo SDK 55**. Reads the target path from `docs/project.config.yaml`. Overlay files in `./overlay/` are copied verbatim into the target project; identity fields are auto-detected from existing project artifacts and confirmed with the user before any filesystem action.

> **Variable substitution rules.** Two tokens are used throughout. `<MOBILE_PATH>` — substitute with the matched scope's path (e.g., `apps/mobile`, `apps/app`, `packages/mobile`). `<SCOPE>` — substitute with the matched scope's key in `repo.scopes` (e.g., `mobile`). Both are resolved in the `Required config` step.

## When to run

Invoke when you want to bootstrap the RN runtime with the opinionated Expo SDK 55 stack.

**Prerequisite**: `docs/project.config.yaml` must have an Expo RN scope under `repo.scopes` (`runtime: react-native-expo` + `framework: expo`, with `framework_version` ~55 and `styling: unistyles` ^3). If config is missing or no scope matches, the skill aborts in the `Required config` precondition check.

Do **not** run to "update" an existing project — this skill creates a new project via `create-expo-app`.

> Where this skill sits in the broader nidost workflow (relative to spec/draft/dev phases) is documented in `README.md`, not here. This skill only enforces its config precondition.

## Required config (precondition, runs first)

Read `docs/project.config.yaml` from the project root. Expected shape:

```yaml
repo:
  scopes:
    <scope-name>:                 # any key — e.g., "mobile"
      path: apps/mobile           # ← routing key. Skill scaffolds at this path.
      runtime: react-native-expo  # ← match condition 1
      framework: expo             # ← match condition 2
      framework_version: "~55"    # ← SDK 55 check (~55 / ^55 / 55.x.x all match)
      styling: unistyles          # ← Unistyles check
      styling_version: "^3"       # ← v3 check (^3 / ~3 / 3.x.x all match)
```

If `docs/project.config.yaml` does not exist, abort:

> ❌ `docs/project.config.yaml`을 찾을 수 없습니다. `/nidost:compile-project-config`로 컴파일하세요.

### Scope match

Find scopes in `repo.scopes` where `runtime == "react-native-expo"` AND `framework == "expo"`.

| Match count | Action                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0           | abort: "config에 Expo RN scope가 없습니다. `/nidost:compile-project-config`로 갱신하세요."                                                                                              |
| 1           | proceed. Store this scope's `path` as `<MOBILE_PATH>` and its key as `<SCOPE>`. All subsequent steps use these variables.                                                               |
| 2+          | abort: "config에 Expo RN scope가 여러 개({SCOPE_NAMES})입니다. 본 스킬은 단일 RN 앱만 지원합니다. config를 검토하거나 scope를 명시하는 sibling 스킬을 사용하세요."                       |

### Stack version check

For the matched scope, all four fields must match:

| Field               | Expected                            | On mismatch                                                                                                                                |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `framework`         | `expo`                              | abort: "framework가 `expo`가 아닙니다. 본 스킬은 Expo 전용입니다."                                                                          |
| `framework_version` | major 55 (`~55` / `^55` / `55.x.x`) | abort: "framework_version이 SDK 55가 아닙니다. 본 스킬은 SDK 55 전용입니다. 다른 버전은 별도 스킬이거나 config 수정이 필요합니다."           |
| `styling`           | `unistyles`                         | abort: "styling이 unistyles가 아닙니다."                                                                                                    |
| `styling_version`   | major 3 (`~3` / `^3` / `3.x.x`)     | abort: "styling_version이 v3이 아닙니다. 본 스킬은 Unistyles v3 전용입니다."                                                                |

After all checks pass, report once and proceed:

```
✓ Config 매칭 확인
  scope:    <scope-name>
  path:     <MOBILE_PATH>
  stack:    Expo SDK 55 + Unistyles v3
```

## Inputs (auto-detect, then confirm)

Collect three identity values. Auto-detect each from existing project artifacts, then confirm all three in a single `AskUserQuestion` call before any filesystem action.

### Auto-detection

1. **`projectName`** — kebab-case. Regex: `^[a-z][a-z0-9-]*$`. Used as `package.json.name`, `app.json.slug`, `app.json.scheme`. Detection order:
   1. Root `package.json` `name` field, if present and matches the regex.
   2. `basename "$PWD"` normalized to kebab-case (lowercase; spaces/underscores → `-`; strip non `[a-z0-9-]`; collapse repeats; trim leading/trailing `-`).
2. **`displayName`** — human-readable. Used as `app.json.name`. Detection order:
   1. First `# ` heading text in `README.md` (strip surrounding whitespace).
   2. `projectName` title-cased (`my-cool-app` → `My Cool App`) as final fallback.
3. **`bundleId`** — reverse-domain. Regex: `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$`. Used for both `ios.bundleIdentifier` and `android.package`. Detection order:
   1. Grep `docs/spec/architecture.md` for an existing `bundleIdentifier` / `package` value matching the regex; use it if found.
   2. Default: `com.example.<projectName-with-hyphens-removed>` (e.g. `my-cool-app` → `com.example.mycoolapp`).

If a detected `projectName` or `bundleId` fails its regex, drop down to the next source rather than sanitizing silently. `displayName` has no regex and accepts any non-empty string.

### Confirmation (mandatory, blocking)

Make a single `AskUserQuestion` call with three questions, one per field. For each question:

- Question text: e.g. "`projectName`을 `<detected>`로 사용할까요?"
- Header: `projectName` / `displayName` / `bundleId`
- Options (2):
  1. label: `<detected> 사용` — description: source of the default (e.g. "package.json에서 추출", "PRD 제목에서 추출", "기본값 com.example.<name>")
  2. label: "다른 값 입력" — description: "선택 후 직접 입력"

The `AskUserQuestion` tool always exposes an "Other" branch automatically; treat that branch as free-form input. If a user-provided custom value fails its regex, re-prompt with the same question (one retry per field) and a corrected hint. After two failures on the same field, abort and tell the user to re-invoke the skill once they have a valid value in mind.

After confirmation, echo the final triple back to the user as a single block before proceeding:

```
projectName: <value>
displayName: <value>
bundleId:    <value>

<MOBILE_PATH>/에 위 값으로 scaffold합니다.
```

## Re-run guard (check BEFORE scaffolding)

Abort with a clear message if any of the following is true:

- `<MOBILE_PATH>/` already exists **and** is non-empty.
- `<MOBILE_PATH>/src/unistyles.ts` exists, OR `<MOBILE_PATH>/babel.config.js` references `react-native-unistyles/plugin` (indicates the skill has already been applied).
- The CWD is not the project root (e.g. user is already inside `apps/`). Detect by checking that `docs/` exists at CWD.

On abort, suggest: "Remove or empty `<MOBILE_PATH>/` first, or `cd` to the project root."

## Pre-flight check (run AFTER `create-expo-app`, BEFORE overlay)

All paths are relative to `<MOBILE_PATH>/`. For each file the overlay will overwrite, confirm it exists and looks like the default `create-expo-app` template output:

| File                                 | Quick signal it's untouched template output                                       |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `<MOBILE_PATH>/src/app/_layout.tsx`  | contains `ThemeProvider` or `AnimatedSplash` import (template's multi-tab layout) |
| `<MOBILE_PATH>/src/app/index.tsx`    | contains `Welcome to Expo` or `HintRow` import                                    |
| `<MOBILE_PATH>/babel.config.js`      | **must NOT exist** — template does not ship one by default; overlay creates it    |
| `<MOBILE_PATH>/eslint.config.js`     | **must NOT exist** — same reason                                                  |

If `babel.config.js` or `eslint.config.js` already exist under `<MOBILE_PATH>/`, stop and tell the user: "This doesn't look like a fresh `create-expo-app` scaffold." If `_layout.tsx` / `index.tsx` no longer match the template, warn but continue — the overlay will overwrite them anyway.

## Execution steps

The skill is invoked from the **project root** (the directory that contains `docs/`). All paths below are relative to that root. Steps 2–8 operate on files under `<MOBILE_PATH>/`.

### Step 1 — Scaffold fresh Expo project at `<MOBILE_PATH>/`

```sh
mkdir -p $(dirname <MOBILE_PATH>)
npx create-expo-app@latest <MOBILE_PATH> --template default@sdk-55
```

If `<MOBILE_PATH>` is a single-segment path (no parent), `mkdir -p .` is a no-op and harmless.

Do **not** `cd` into `<MOBILE_PATH>`. Subsequent steps use absolute or `<MOBILE_PATH>/`-prefixed paths so the working directory stays at the project root (this keeps `docs/`, `Makefile`, etc. visible to later tooling). When a sub-step requires running `npm`/`npx` commands that resolve to `<MOBILE_PATH>/package.json`, prefix with `cd <MOBILE_PATH> && …` inline within that single Bash call rather than persistently changing directory.

### Step 2 — Cleanup

Delete template cruft inside `<MOBILE_PATH>/`:

```sh
cd <MOBILE_PATH> && rm -rf src/components src/constants src/hooks src/global.css \
  && rm -f src/app/explore.tsx \
  && rm -rf \
    assets/images/tabIcons \
    assets/images/react-logo.png \
    assets/images/react-logo@2x.png \
    assets/images/react-logo@3x.png \
    assets/images/expo-badge.png \
    assets/images/expo-badge-white.png \
    assets/images/expo-logo.png \
    assets/images/logo-glow.png \
    assets/images/tutorial-web.png \
    assets/images/favicon.png \
  && rm -rf scripts
```

### Step 3 — Apply overlay

Copy every file under the skill's `overlay/` directory into `<MOBILE_PATH>/`, preserving structure:

```sh
cp -R <skill-dir>/overlay/. <MOBILE_PATH>/
```

Where `<skill-dir>` is the absolute path to this skill's directory (the directory containing this `SKILL.md`). Use `cp -R` with a trailing `/.` on the source so hidden files (`.prettierrc`, `.prettierignore`) are copied.

After this step, these files will exist under `<MOBILE_PATH>/`:

- `babel.config.js`, `eslint.config.js`, `.prettierrc`, `.prettierignore`
- `index.ts`
- `src/unistyles.ts`, `src/app/_layout.tsx`, `src/app/index.tsx` (overwrites template versions)

### Step 4 — Edit `<MOBILE_PATH>/package.json`

Use the `Edit` tool, not `sed`, for JSON edits. Target file: `<MOBILE_PATH>/package.json`. The edits are:

1. Set `"main"` to `"index.ts"` (was `"expo-router/entry"`).
2. Set `"name"` to `<projectName>`.
3. Set `"version"` to `"0.0.1"`.
4. Remove scripts: `"web"`, `"reset-project"`.
5. Add scripts in this order after `"lint"`:
   ```json
   "lint:fix": "expo lint -- --fix",
   "format": "prettier --write .",
   "format:check": "prettier --check .",
   "smoke:min": "tsc --noEmit && npm run lint && npm run format:check && npx expo-doctor",
   "smoke": "npm run smoke:min && npx expo export --platform ios --no-minify --no-bytecode --output-dir .expo/smoke-bundle && rm -rf .expo/smoke-bundle"
   ```
6. Remove from `dependencies`: `@react-navigation/bottom-tabs`, `@react-navigation/elements`, `expo-device`, `expo-glass-effect`, `expo-symbols`, `expo-web-browser`, `react-dom`, `react-native-web`.

Do **not** remove other packages (`@react-navigation/native`, `react-native-gesture-handler`, etc.). They're retained intentionally.

### Step 5 — Edit `<MOBILE_PATH>/app.json`

Use the `Edit` tool for each change. Target file: `<MOBILE_PATH>/app.json`.

1. Remove the entire `"web": { ... }` block.
2. Add `"platforms": ["ios", "android"]` immediately after `"userInterfaceStyle": "automatic",`.
3. Set `expo.name` to `<displayName>`.
4. Set `expo.slug` to `<projectName>`.
5. Set `expo.scheme` to `<projectName>`.
6. Set `expo.ios.bundleIdentifier` to `<bundleId>`. Create the `ios` block if absent.
7. Set `expo.android.package` to `<bundleId>`. Create the `android` block if absent.

### Step 6 — Replace `<MOBILE_PATH>/README.md`

Overwrite the template's `<MOBILE_PATH>/README.md` with a minimal one. Do **not** touch the project root `README.md` — that one is owned by `init` / `spec-prd`.

```markdown
# <displayName>

Scaffolded via the `expo-sdk55-unistyles-stack` skill (Expo SDK 55 + expo-router + Unistyles v3 + ESLint + Prettier + smoke scripts).

## Commands

- `npm start` — launch Metro dev server
- `npm run ios` / `npm run android` — build & run on a simulator (requires dev client, `expo prebuild` the first time)
- `npm run lint` / `npm run lint:fix`
- `npm run format` / `npm run format:check`
- `npm run smoke:min` — static + config gate (~7s)
- `npm run smoke` — `:min` plus iOS bundle export (~16s)
```

Substitute `<displayName>` literally.

### Step 7 — Install dependencies

Run in order (each must finish before the next). Each command runs against `<MOBILE_PATH>/package.json`:

```sh
cd <MOBILE_PATH> && npx expo install react-native-unistyles react-native-nitro-modules expo-dev-client
cd <MOBILE_PATH> && npm install --save-dev --save-exact prettier
cd <MOBILE_PATH> && npx expo install eslint eslint-config-expo eslint-config-prettier -- --save-dev
```

**Known gotcha:** after the ESLint install, `eslint-config-expo` will land in `dependencies` instead of `devDependencies`. Move it manually in `<MOBILE_PATH>/package.json` with `Edit`, then run `cd <MOBILE_PATH> && npm install` one more time to resync the lockfile.

### Step 8 — Verify

```sh
cd <MOBILE_PATH> && npm run smoke
```

Must exit `0`. Expected: `18/18 checks passed`, iOS bundle ~4.4 MB, `<MOBILE_PATH>/.expo/smoke-bundle/` deleted at the end.

If anything fails, do **not** retry blindly. Print the failing tool's output to the user and stop — the reproduction is not idempotent past this point.

### Step 8.5 — Write `<MOBILE_PATH>/Makefile.targets`

The project root `Makefile` (created by `init`) `-include`s `apps/*/Makefile.targets`, so each scaffolder owns a snippet inside its own scope directory rather than editing the root file. Use the `Write` tool to create `<MOBILE_PATH>/Makefile.targets` with the content below.

**Critical:** Makefile recipe lines (the lines after each target) must start with a literal **TAB**, not spaces. The `Write` tool preserves whitespace exactly as supplied, so the call must contain real tab characters. Do not let formatting helpers replace tabs with spaces.

```make
.PHONY: <SCOPE>-start <SCOPE>-ios <SCOPE>-android <SCOPE>-lint <SCOPE>-lint-fix <SCOPE>-format <SCOPE>-format-check <SCOPE>-smoke-min <SCOPE>-smoke

help::
	@echo ""
	@echo "<SCOPE> (<MOBILE_PATH>):"
	@echo "  <SCOPE>-start         Launch Metro dev server"
	@echo "  <SCOPE>-ios           Build & run on iOS simulator"
	@echo "  <SCOPE>-android       Build & run on Android emulator"
	@echo "  <SCOPE>-lint          Run ESLint"
	@echo "  <SCOPE>-lint-fix      Run ESLint with --fix"
	@echo "  <SCOPE>-format        Run Prettier --write"
	@echo "  <SCOPE>-format-check  Run Prettier --check"
	@echo "  <SCOPE>-smoke-min     Static + config gate (~7s)"
	@echo "  <SCOPE>-smoke         smoke-min plus iOS bundle export (~16s)"

<SCOPE>-start:
	cd <MOBILE_PATH> && npm start

<SCOPE>-ios:
	cd <MOBILE_PATH> && npm run ios

<SCOPE>-android:
	cd <MOBILE_PATH> && npm run android

<SCOPE>-lint:
	cd <MOBILE_PATH> && npm run lint

<SCOPE>-lint-fix:
	cd <MOBILE_PATH> && npm run lint:fix

<SCOPE>-format:
	cd <MOBILE_PATH> && npm run format

<SCOPE>-format-check:
	cd <MOBILE_PATH> && npm run format:check

<SCOPE>-smoke-min:
	cd <MOBILE_PATH> && npm run smoke:min

<SCOPE>-smoke:
	cd <MOBILE_PATH> && npm run smoke
```

Substitute every `<SCOPE>` with the matched scope key and every `<MOBILE_PATH>` with its path before writing. The `help::` rule uses double-colon so it appends to (not replaces) the root Makefile's existing help output.

**Verify the snippet is wired up.** Run from the project root:

```sh
make -n <SCOPE>-smoke
```

It must print `cd <MOBILE_PATH> && npm run smoke` (the `-n` dry-run prints the recipe without executing). If `make` reports `*** No rule to make target` instead, the snippet path or root `-include` glob is wrong — stop and report to the user.

### Step 9 — Report

Tell the user:

```
✅ <MOBILE_PATH>/ scaffolded.

  projectName: <projectName>
  displayName: <displayName>
  bundleId:    <bundleId>
  location:    <absolute path to <MOBILE_PATH>>

Next steps (from project root):
- make <SCOPE>-start               # Metro dev server
- make <SCOPE>-ios                 # or make <SCOPE>-android
- make <SCOPE>-smoke               # run before every commit
- make help                        # see all <SCOPE>-* targets

Real device/simulator builds (first time only):
- cd <MOBILE_PATH> && npx expo prebuild --clean

권장: /nidost:compile-project-config --check
       (디스크-config 정합성 확인 — 본 스킬이 만든 디렉토리가 config와 일치하는지 검증)

다음 스킬: /nidost:ticket
```

## Notes for future maintenance of this skill

- **Layout source.** The target path comes from `docs/project.config.yaml` `repo.scopes.<scope>.path` (matched by `runtime: react-native-expo` + `framework: expo`). The skill aborts if config is missing or no scope matches. To support multi-app projects (e.g., `apps/customer-mobile` + `apps/admin-mobile`), the matching algorithm in `Required config` would need a `--scope <name>` argument override.
- **Auto-detection sources.** The order is package.json → README → basename for `projectName`, README → titlecase for `displayName`, architecture-grep → `com.example.<name>` for `bundleId`. PRD was intentionally dropped from `displayName` sources — PRD H1 tends to be a *document title* (`# <Project> PRD`, `# <Project> 기획서`) rather than the product display name, and contaminated detections often slipped past the confirmation step. If a project later writes identity into a different artifact (e.g., a dedicated `docs/spec/identity.md` or a `project.bundle_id` field in `project.config.yaml`), add it to the detection chain and prefer it before the existing fallbacks.
- **Overlay files are mirrors of this repo's current state.** When the source repo's `babel.config.js`, `eslint.config.js`, theme, etc. change, the overlay must be re-copied. There is no automated sync.
- **SDK pin.** `--template default@sdk-55` is intentional and matched against `framework_version` in config. When upgrading to SDK 56+, create a sibling skill (`expo-sdk56-unistyles-stack`) rather than mutating this one — the skill name encodes the version contract. Common logic (scope matching, identity detection) can be extracted into a shared skill at that point.
- **Reproduction docs are skill-internal.** `docs/01-cleanup.md` through `docs/06-smoke.md` live with the skill, not in the scaffolded project. Their audience is whoever maintains this skill (regenerating the overlay on SDK upgrades, debugging why a particular dep was dropped, etc.). They reference `mobile` as the example project name throughout — that's the recorded reproduction artifact, not a layout commitment. The skill itself reads `<MOBILE_PATH>` from config.
- **Identity substitution breadth.** Current substitution touches 7 fields (see `app.json` + `package.json` changes). If the overlay adds more identity-sensitive files later (e.g., `eas.json`, iOS entitlements), expand Step 4/5 accordingly.
- **Make-targets snippet.** `<MOBILE_PATH>/Makefile.targets` (Step 8.5) is auto-included by the root Makefile via `-include apps/*/Makefile.targets`. Each stack scaffolder owns its own snippet — do not edit the root Makefile from this skill. If new npm scripts are added to Step 4, mirror them as `<SCOPE>-*` targets in Step 8.5 (and the `help::` block) so they're reachable from project root.
- **Failure recovery.** This skill does not clean up on partial failure. If Step 7 or 8 fails, the user has a half-configured `<MOBILE_PATH>/`. Document this explicitly to them; don't attempt auto-rollback. Manual recovery: `rm -rf <MOBILE_PATH> && re-invoke the skill`.
