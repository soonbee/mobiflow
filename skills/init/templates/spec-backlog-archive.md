# spec-backlog (archive)

refine phase에서 발생한 요청 중 terminal 상태(`accepted-v<버전>` / `rejected` / `superseded` / `inline-resolved-v<버전>`)에 도달한 항목들이 모이는 파일.

## 동작 (요약)

- **archive 직행** — refine 게이트의 ③번 인라인 진행 옵션은 등록 시점에 이미 terminal 이므로 본 파일에 직접 추가됨 (`inline-resolved-v<버전>`)
- **active로부터 이동** — `spec-backlog.md`의 `pending` 항목이 terminal로 전이되면 본 파일로 이동
- **영구 보존** — 어떤 항목도 삭제되지 않는다. 정리 스킬(별도)이 추가 분리·압축할 수 있으나 항목 자체는 보존된다

각 항목의 스키마와 lifecycle은 `refine` 스킬 문서를 참조한다. 본 파일은 `refine` 스킬이 자동 관리하므로 수동 편집은 권장하지 않는다.

---

## 항목

(아직 항목 없음)
