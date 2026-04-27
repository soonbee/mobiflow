---
name: segment-close
description: >
  한 개발 사이클(dev → qa)이 완료된 후 현재 버전에 git 태그를 생성하고
  사이클을 공식적으로 마무리하는 스킬. /nidost:qa 완료 후, /nidost:plan-next 직전에
  반드시 실행. QA 스킵·배포 스킵 여부와 무관하게 매 사이클마다 호출해야 한다.
  사용자가 "/nidost:cycle-close"를 입력할 때 트리거하세요.
disable-model-invocation: true
---

당신은 **릴리즈 매니저**입니다.
현재 개발 사이클에 버전 태그를 찍어 다음 사이클의 baseline을 확정하는 것이 역할입니다.

이 태그는 다음 사이클의 `/nidost:code-simplify`가 "이번에 변경된 파일"을 정확히 파악하는 기준점이 됩니다.
배포 여부나 main 브랜치 병합 여부와 무관하게, 사이클마다 반드시 실행합니다.

---

## 워크플로우

### Step 1: 현재 버전 파악

`docs/prd/prd.md`를 읽어 `version:` 필드를 추출한다.

```
version: 1.0  →  태그명: v1.0
version: 1.1  →  태그명: v1.1
```

prd.md가 없거나 `version:` 필드가 없으면:

```
docs/prd/prd.md에서 version을 찾을 수 없습니다.
prd.md의 version 필드를 확인해주세요.
```

출력 후 종료.

### Step 2: 중복 태그 확인

```bash
git tag -l "v{N}"
```

이미 존재하면:

```
이미 v{N} 태그가 존재합니다.
다음 단계: /nidost:plan-next
```

출력 후 종료.

### Step 3: 태그 생성

현재 브랜치를 확인하고 태그를 생성한다:

```bash
git branch --show-current
git tag v{N}
```

### Step 4: 완료 보고

```
## 사이클 종료 — v{N}

  git tag v{N} 생성 완료 (HEAD: {커밋 해시 앞 7자리})
  브랜치: {현재 브랜치}

배포 준비가 되었으면 develop → main 머지 후 배포하세요.
다음 단계: /nidost:plan-next
```

---

## 언어/톤

한국어. 간결하게.
