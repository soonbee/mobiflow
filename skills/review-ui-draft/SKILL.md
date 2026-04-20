---
name: review-ui-draft
description: 정적 UI 시안(docs/ui-drafts/)의 품질을 점검하는 체크리스트. 명세 충실도, 토큰·디자인 언어 준수, 공통 자산 일관성을 강한 판정으로 다루고, 정성적 디자인 인상은 약한 평론 노트로 분리해 사람의 판단에 위임한다. 시안 작성 완료 후 검수 단계에서 사용한다.
disable-model-invocation: true
---

# review-ui-draft

UI 시안(`docs/ui-drafts/`) 검수 기준. 시안 자체를 수정하지 않고 발견 사항만 보고한다.

검수는 **강한 판정**(자동 수정 트리거가 되는 위반)과 **약한 평론 노트**(사람 판단을 돕는 정성 인상)로 명확히 분리한다. 디자인의 정성적 평가는 자동화하지 않는다 — 그건 사람의 몫이다.

## 검수 입력

- `docs/ui-design/ui-design.md` (명세 SSOT)
- `docs/design-tokens/design-tokens.md` (토큰 SSOT)
- `docs/ui-drafts/_shared/` (공통 자산)
- `docs/ui-drafts/SCR-xxx/` (각 화면 시안)

ui-design.md §3 화면별 명세와 시안을 1:1로 대조하고, _shared의 일관성도 함께 점검한다.

## 점검 절차

1. ui-design.md §1 화면 목록을 읽고 시안 디렉토리와 매칭. 누락/잉여 확인
2. _shared/ 구성 점검 (tokens.css, aesthetic.md, partials, includer.js 존재)
3. 각 SCR-xxx마다 강한 판정 체크리스트 적용
4. 전 화면을 가로지르는 일관성 점검 (partial 사용, 톤 정합)
5. 정성 평론 노트는 별도 섹션에 기록

## 강한 판정 체크리스트 (수정 필요)

자동 수정 트리거가 되는 항목. 한 건이라도 발견되면 러너가 해당 화면 또는 _shared의 재빌드를 요청한다.

### 1. 명세 누락

- [ ] ui-design.md §3에 명시된 UI 요소가 시안에 빠짐없이 존재한다
- [ ] ui-design.md §3에 명시된 상태(로딩·빈·에러·성공)가 모두 시안에서 시연 가능하다
- [ ] ui-design.md §1에 있는 화면 ID가 모두 `docs/ui-drafts/SCR-xxx/`로 존재한다 (잉여 시안도 보고)
- [ ] ui-design.md §3에 명시된 변형(권한별·A/B 등)이 `variants/` 또는 토글로 시연된다

### 2. 공통 자산 일관성

- [ ] 헤더·탭바·푸터 등 구조 partial은 모든 화면이 `data-include`로 참조한다 (복붙 금지)
- [ ] partial 자체가 화면별로 수정되지 않았다 (헤더 마크업이 화면마다 다르면 위반)
- [ ] `_shared/tokens.css`에 design-tokens.md의 토큰이 누락 없이 변환되어 있다
- [ ] 화면 `style.css`가 raw 값 대신 `tokens.css` 변수를 사용한다 (의도된 예외는 notes.md에 기록)
- [ ] `_shared/aesthetic.md` 7개 섹션(큰 방향·색 분포·공간 리듬·타이포 위계·모서리·모션·금지 목록)이 모두 채워져 있다
- [ ] **[viewports에 mobile 포함 시]** `_shared/templates/scr-mobile.html`과 `_shared/partials/phone-shell.css`가 존재한다
- [ ] **[mobile]** `phone-shell.css`의 구조 규칙(width·min-height·box-sizing·position·overflow-x 블록, 시각 바인딩 블록)이 `dev-ui-draft` §「프레임 규약 — 레퍼런스 구현」과 일치한다. `--shell-viewport-w`·`--shell-viewport-h`만 프로젝트 viewports 값에 맞게 변경되어 있다
- [ ] **[mobile]** `tokens.css`에 phone-shell.css가 요구하는 4개 바인딩 토큰(`--color-canvas`·`--color-fg-primary`·`--font-body`·`--text-body`)이 존재한다 (직접 선언 또는 alias)
- [ ] **[mobile]** 목업 전용 토큰(`--shell-*`)이 `tokens.css`가 아니라 `phone-shell.css`의 `.phone-shell` 스코프에서만 선언된다. `design-tokens.md`에 없는 토큰이 tokens.css에 섞여 있으면 위반 (tokens.css는 design-tokens.md의 순수 미러여야 함)
- [ ] **[mobile]** status-bar.css·home-indicator.css가 자체 하드코딩 대신 `var(--shell-status-bar-h)`·`var(--shell-home-indicator-h)`를 상속 사용한다
- [ ] **[mobile]** 모든 `SCR-*/index.html` 및 `variants/*.html`의 루트가 `<main class="phone-shell" data-viewport="mobile">`로 **동일**하다. 제각각 클래스(`frame`/`device-frame`/`phone-frame` 등)가 섞여 있으면 위반
- [ ] **[mobile]** 모든 SCR의 viewport meta, tokens/phone-shell/status-bar/home-indicator 필수 링크 4줄, status-bar/home-indicator `data-include` 2줄이 템플릿과 동일하다 (순서·제거·변경 없음)
- [ ] **[mobile]** 화면 `style.css`가 `.phone-shell` 루트 컨테이너의 치수·라운드 코너·배경을 재정의하지 않는다 (phone-shell.css가 단일 소스)

### 3. aesthetic.md 위반

- [ ] aesthetic.md "금지 목록"의 항목이 시안에 등장하지 않는다 (예: "그라데이션 금지" 명시 시 그라데이션 사용한 화면은 위반)
- [ ] aesthetic.md "색 분포" 규칙이 지켜진다 (예: "액센트는 화면당 1~2회" 명시 시 5회 사용한 화면은 위반)
- [ ] aesthetic.md "모서리 & 깊이" 규칙이 지켜진다

### 4. notes.md 누락

- [ ] 모든 SCR-xxx에 `notes.md`가 존재한다
- [ ] notes.md에 의도·뷰포트·상태 변화·검토 방법이 모두 기재되어 있다
- [ ] `variants/` 폴더가 있는 경우 notes.md의 「변형」 표와 1:1 매칭

### 5. 정적 자체 완결성

- [ ] 외부 빌드 도구·노드 모듈 의존이 없다
- [ ] 외부 CDN 사용이 폰트로 한정된다 (아이콘은 인라인 SVG)
- [ ] React·Vue 등 프레임워크가 도입되지 않았다

## 약한 평론 노트 (참고용 — 자동 수정 트리거 아님)

다음 항목은 정성적 인상에 대한 의견. 위반이 아니라 **사람이 판단할 입력**으로만 출력한다. 러너는 이 항목으로 재빌드를 트리거하지 않는다.

각 화면별로 1~3문장씩 작성한다.

- **임팩트**: 이 화면이 사용자에게 주는 첫 인상이 명세의 의도(`notes.md` 「의도」)와 부합하는가
- **시각 무게 분포**: 강조와 여백의 균형, 시선 흐름의 자연스러움
- **화면 간 톤 정합성**: 다른 화면들과 같은 디자이너가 만든 것처럼 보이는가, 톤 격차가 큰 화면이 있는가
- **자유 합성의 다양성**: 패턴 컴포넌트(버튼·카드 등)가 화면 맥락에 맞게 변주되어 있는가, 또는 모든 화면이 똑같이 안전한 형태로 회귀하지 않았는가

평론 노트는 "좋다/나쁘다" 단정이 아니라 **관찰**로 작성한다. 예: "랜딩 화면의 hero 영역은 명세 의도(대담함)와 잘 맞으나, 푸터 직전 CTA 섹션이 hero 대비 시각 무게가 약해 마무리 인상이 흐려진다."

## 출력 포맷

검수 결과는 4구역으로 분리한다.

```
🔴 수정 필요 (Must Fix)
- [SCR-001/index.html] {위반 항목} - ui-design.md §3에 명시된 "에러 상태"가 시연되지 않음
- [_shared/aesthetic.md] {위반 항목} - "공간 리듬" 섹션이 비어 있음
- [SCR-003/style.css:42] {위반 항목} - raw 색상값 #3a7bd5 사용 (tokens.css 변수 없음)

🟡 권장 (Should Fix)
- [SCR-002/notes.md] {권장 항목} - 「가정」 섹션 누락. 시안의 임의 결정이 있다면 명시 권장

🟢 통과 (Pass)
- _shared/ 구성 완전
- partial 일관성 OK (8개 화면 모두 헤더 동일)
- tokens.css 변수 사용 정합

📝 평론 노트 (참고용)
- [SCR-001 랜딩] hero 영역의 대담한 타이포가 명세 의도와 잘 맞음. 단 우측 여백이 좁아 호흡감 약함
- [SCR-005 설정] 다른 화면 대비 색 사용이 절제되어 톤 격차 미미. 의도된 것이라면 OK, 아니라면 액센트 1회 정도 보강 고려
- [전체] 모든 화면이 같은 그리드 모듈을 따라 톤 정합성 양호
```

각 구역 끝에 합계: `수정 필요: N건 | 권장: N건 | 통과: N건 | 평론 노트: N건`

## 보고 원칙

- 강한 판정은 **명세·토큰·aesthetic.md·구조 일관성**이라는 객관 기준만 사용. "이 디자인이 별로다"는 강한 판정 아님
- 약한 평론 노트는 **관찰**로만 작성. 명령형("~를 바꿔라") 금지
- 평론 노트로 인한 재작업 여부는 사용자가 결정. 검수자는 트리거하지 않는다
- 발견 사항이 없으면 각 구역에 "이상 없음"으로 명시 (구역 자체를 생략하지 않음)
- 스크린샷은 뷰포트 샷(`screenshots/default*.png`)을 첫인상 판단의 primary 근거로 보고, 풀 샷(`screenshots/default.full*.png`)은 아래 접지 콘텐츠 완결성 보조로만 참조한다. 풀 샷의 높이·길이 자체는 판정 대상이 아님
