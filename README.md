# 삼뱌꾸샴붓다 (sambyakku-shambuda)

산스크리트(데바나가리) · 실담(Siddhaṃ) 자모 학습용 Capacitor + React 앱.

## 개발

```bash
npm install
npm run dev
```

## 획 이론값 (클라우드)

교사 기록은 GitHub 저장소의 `cloud/taughtStrokes.json`에 저장됩니다.

1. [Fine-grained PAT](https://github.com/settings/tokens?type=beta) 생성  
   - Repository access: 이 저장소만  
   - Permissions → Contents: **Read and write**
2. 앱 → 글자 상세 → 획 가르치기 → **토큰 설정** (기기 localStorage에만 저장)
3. 기록 → **이론값 저장** → 클라우드 반영
4. 다른 기기: **클라우드 불러오기**

출시 전 내장:

```bash
npm run strokes:pull
```

이후 획 가르치기 UI를 제거하고 `src/data/taughtStrokes.json`만 사용합니다.

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run strokes:pull` | 클라우드 → 앱 내장 `taughtStrokes.json` |
| `npm run strokes:generate` | 미가르친 글자용 자동 획 경로 생성 |
| `npm run build:android` | 웹 빌드 + Capacitor Android sync |
