# 매출매입 분석 앱

계정별원장 엑셀 파일 업로드 → 유형별 매출·매입·손익 자동 집계 모바일 웹앱

---

## Vercel 배포 방법 (5분)

### 1단계 — GitHub 저장소 만들기
1. [github.com](https://github.com) 로그인
2. 우상단 **+** → **New repository**
3. Repository name: `sales-analysis` (또는 원하는 이름)
4. **Public** 선택 → **Create repository**

### 2단계 — 파일 업로드
1. 생성된 저장소에서 **Add file** → **Upload files**
2. 이 ZIP의 `sales-app` 폴더 안 파일 전체 업로드:
   - `app/` 폴더
   - `package.json`
   - `next.config.js`
   - `vercel.json`
   - `.gitignore`
3. **Commit changes** 클릭

### 3단계 — Vercel 배포
1. [vercel.com](https://vercel.com) 접속 → GitHub으로 로그인
2. **Add New Project** → 방금 만든 저장소 선택
3. **Import** → 설정 그대로 → **Deploy**
4. 1~2분 후 `https://sales-analysis-xxx.vercel.app` 링크 생성! 🎉

---

## 파일 구성

```
sales-app/
├── app/
│   ├── layout.js       # HTML 기본 구조
│   ├── page.js         # 메인 진입점
│   ├── SalesApp.js     # 앱 전체 로직 + UI
│   └── styles.module.css  # 스타일
├── package.json
├── next.config.js
└── vercel.json
```

## 필요 컬럼 (엑셀)

`계정코드` · `계정명` · `년월` · `차변금액` · `대변금액` · `적요` · `거래처`
