export const metadata = {
  title: '매출매입 분석',
  description: '계정별원장 엑셀 업로드 → 유형별 매출·매입·손익 자동 집계',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0, background: '#f4f5f7', fontFamily: "'Noto Sans KR', sans-serif" }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet" />
        {children}
      </body>
    </html>
  )
}
