# 매출매입 분석 앱 v5

계정별원장 엑셀 → 유형별 매출·매입·손익 비교 분석 모바일 웹앱

---

## 권한 구조

| 구분 | 기능 |
|------|------|
| **일반 사용자** | 링크 접속 → 분석 결과 조회만 가능 |
| **관리자 (ds / 0000)** | 로그인 후 엑셀 업로드 → 전체 사용자에게 즉시 반영 |

---

## Vercel 배포 (5분)

### 1. GitHub 저장소 만들기
1. github.com → **New repository** (이름: `sales-analysis`)
2. ZIP 압축 해제 후 `sales-app` 폴더 파일 전체 업로드
3. Commit changes

### 2. Vercel 배포
1. vercel.com → GitHub 로그인 → 저장소 Import
2. **Environment Variables** 추가:
   - `JWT_SECRET` = `원하는랜덤문자열` (예: `myapp-secret-xyz-2024`)
3. Deploy → 완료!

### 3. 사용 방법
1. 배포된 URL 접속 → 일반 사용자는 바로 조회
2. 헤더 우상단 **관리자** 버튼 → `ds` / `0000` 로그인
3. 엑셀 업로드 → 전체 사용자에게 즉시 반영

---

## 파일 구성

```
app/
├── api/
│   ├── auth/route.js    # 로그인/로그아웃/세션확인
│   ├── upload/route.js  # 엑셀 업로드 (관리자 전용)
│   └── data/route.js    # 저장 데이터 조회 (전체 공개)
├── SalesApp.js          # 메인 UI
├── styles.module.css
├── layout.js
└── page.js
```

## 필요 컬럼
`계정코드` · `계정명` · `년월` · `차변금액` · `대변금액` · `적요` · `거래처`

## 주의사항
- Vercel 무료 플랜은 `/tmp` 파일이 서버리스 함수 재시작 시 초기화될 수 있습니다
- 데이터 영구 저장이 필요하면 Vercel KV(무료) 연동을 추천합니다
