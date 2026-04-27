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
```bash
cd docs/ui-drafts/_shared/_tools && npm run preview
```
또는 무설치:
```bash
cd docs/ui-drafts && python3 -m http.server 8765
```
→ http://localhost:8765/_shared/INDEX.html

스크린샷만 다시 만들고 싶으면:
```bash
node docs/ui-drafts/_shared/_tools/capture.mjs \
  --base-url http://localhost:8765 \
  --shots-root docs/ui-drafts
```
