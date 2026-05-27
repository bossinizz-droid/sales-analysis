'use client'
import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import styles from './styles.module.css'

const PALETTE = [
  ['#1a6ef5','#e8f0fe','#1a3a8f'],
  ['#1a8a4a','#e6f4ec','#145a32'],
  ['#7c3aed','#f3e8ff','#4c1d95'],
  ['#d97706','#fef3c7','#78350f'],
  ['#c2410c','#ffedd5','#7c2d12'],
  ['#be185d','#fce7f3','#831843'],
  ['#0891b2','#e0f2fe','#0c4a6e'],
  ['#65a30d','#f7fee7','#365314'],
  ['#6b7280','#f3f4f6','#374151'],
  ['#9333ea','#faf5ff','#581c87'],
]
function getPalette(idx) { return PALETTE[idx % PALETTE.length] }

function fmt(n, short=true) {
  if (n == null) return '-'
  const a = Math.abs(n)
  if (!short) return Math.round(n).toLocaleString()
  if (a >= 100000000) return (n / 100000000).toFixed(1) + '억'
  if (a >= 10000000)  return Math.round(n / 10000000) + '천만'
  if (a >= 10000)     return Math.round(n / 10000) + '만'
  return n.toLocaleString()
}
function fmtFull(n) { return Math.round(n).toLocaleString() + '원' }
function pctChg(a, b) { if (!b) return null; return ((a - b) / Math.abs(b) * 100).toFixed(1) }
function fmtMo(ym) { return ym ? `${ym.slice(0,4)}.${ym.slice(4)}` : '-' }

function aggregateByCol(rawRows, groupCol) {
  const data = {}
  rawRows.forEach(r => {
    const ymRaw = String(r['년월']||r['연월']||r['회계연월']||'').replace(/[^0-9]/g,'')
    const ym = ymRaw.length>=6 ? ymRaw.slice(0,6) : ymRaw.length===4 ? ymRaw+'01' : ''
    if (!ym) return
    const group = String(r[groupCol]||'(미지정)').trim()||'(미지정)'
    const debit  = parseFloat(String(r['차변금액']||r['차변']||0).replace(/[^0-9.-]/g,''))||0
    const credit = parseFloat(String(r['대변금액']||r['대변']||0).replace(/[^0-9.-]/g,''))||0
    const acctCode = String(r['계정코드']||'')
    const acctName = String(r['계정명']||'')
    if (!data[ym]) data[ym]={}
    if (!data[ym][group]) data[ym][group]={sales:0,purchase:0,count:0,items:[]}
    if (acctCode.startsWith('4')||acctName.includes('매출')||acctName.includes('수익')) {
      data[ym][group].sales += credit||debit
    } else {
      data[ym][group].purchase += debit
    }
    data[ym][group].count++
    if (data[ym][group].items.length<10) data[ym][group].items.push(r)
  })
  return data
}

function getColumns(rows) { return rows.length ? Object.keys(rows[0]) : [] }
function getUniqCount(rows, col) {
  return new Set(rows.map(r=>String(r[col]||'').trim()).filter(Boolean)).size
}

/* ─── 유형별 비교행 데이터 계산 ─── */
function buildCompareRows(mData, prevData, types) {
  return types.map(type => {
    const c = mData[type]   || {sales:0,purchase:0,count:0,items:[]}
    const p = prevData?.[type] || null
    const cProfit = c.sales - c.purchase
    const pProfit = p ? p.sales - p.purchase : null
    return {
      type,
      cur:  { sales: c.sales, purchase: c.purchase, profit: cProfit, count: c.count, items: c.items },
      prev: p ? { sales: p.sales, purchase: p.purchase, profit: pProfit, count: p.count, items: p.items } : null,
      chgSales:   p ? pctChg(c.sales, p.sales) : null,
      chgPurchase: p ? pctChg(c.purchase, p.purchase) : null,
      chgProfit:  p ? pctChg(cProfit, pProfit) : null,
    }
  })
}

export default function SalesApp() {
  const [rawRows, setRawRows]         = useState(null)
  const [columns, setColumns]         = useState([])
  const [groupCol, setGroupCol]       = useState(null)
  const [parsedData, setParsedData]   = useState(null)
  const [months, setMonths]           = useState([])
  const [activeMonth, setActiveMonth] = useState(null)
  const [fileName, setFileName]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(false)
  const [drawer, setDrawer]           = useState(null)
  const [dragging, setDragging]       = useState(false)
  // 비교표 컬럼 토글: 'sales'|'purchase'|'profit'|'chg'
  const [viewCol, setViewCol]         = useState('sales')
  const fileInputRef = useRef()

  const handleFile = useCallback((file) => {
    if (!file) return
    setLoading(true); setError(false)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, {type:'array'})
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, {defval:''})
        if (!rows.length) throw new Error('empty')
        const cols = getColumns(rows)
        const defaultCol = cols.includes('계정명') ? '계정명' : cols[0]
        const data = aggregateByCol(rows, defaultCol)
        const ms = Object.keys(data).sort()
        if (!ms.length) throw new Error('no months')
        setRawRows(rows); setColumns(cols); setGroupCol(defaultCol)
        setParsedData(data); setMonths(ms)
        setActiveMonth(ms[ms.length-1])
        setFileName(file.name); setLoading(false)
      } catch { setError(true); setLoading(false) }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const changeGroupCol = (col) => {
    if (!rawRows) return
    const data = aggregateByCol(rawRows, col)
    const ms = Object.keys(data).sort()
    setGroupCol(col); setParsedData(data); setMonths(ms)
    setActiveMonth(ms[ms.length-1]); setDrawer(null)
  }

  const onFileChange = (e) => handleFile(e.target.files[0])
  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }

  /* ─── 집계 ─── */
  const mData    = parsedData && activeMonth ? parsedData[activeMonth]||{} : {}
  const prevMonth = activeMonth ? months[months.indexOf(activeMonth)-1] : null
  const prevData  = prevMonth && parsedData ? parsedData[prevMonth]||{} : null

  // 전체 유형 집합 (현재월 + 전월 모두 포함)
  const allTypes = [...new Set([
    ...Object.keys(mData),
    ...(prevData ? Object.keys(prevData) : [])
  ])].sort((a,b) => (mData[b]?.sales||0) - (mData[a]?.sales||0))

  const compareRows = buildCompareRows(mData, prevData, allTypes)

  // 합계행
  const totCur  = compareRows.reduce((a,r)=>({sales:a.sales+r.cur.sales, purchase:a.purchase+r.cur.purchase, profit:a.profit+r.cur.profit}),{sales:0,purchase:0,profit:0})
  const totPrev = prevData ? compareRows.reduce((a,r)=>r.prev?{sales:a.sales+r.prev.sales,purchase:a.purchase+r.prev.purchase,profit:a.profit+r.prev.profit}:a,{sales:0,purchase:0,profit:0}) : null

  const drawerRow = drawer ? compareRows.find(r=>r.type===drawer) : null
  const drawerIdx = drawer ? allTypes.indexOf(drawer) : 0

  return (
    <div className={styles.app}>

      {/* ── Header ── */}
      <header className={styles.hdr}>
        <div>
          <h1 className={styles.hdrTitle}>매출매입 분석</h1>
          <p className={styles.hdrSub}>
            {parsedData ? `${months.length}개월 · ${fileName}` : '엑셀 파일을 업로드해 주세요'}
          </p>
        </div>
        <div className={styles.hdrIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </div>
      </header>

      {/* ── Upload ── */}
      <div className={styles.uploadWrap}>
        <div
          className={`${styles.uploadZone} ${dragging?styles.uploadDrag:''} ${fileName?styles.uploadDone:''}`}
          onDragOver={(e)=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={onDrop}
          onClick={()=>fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} style={{display:'none'}}/>
          {loading ? (<><div className={styles.spinner}/><p style={{color:'#1a6ef5',fontWeight:500}}>분석 중...</p></>)
          : error   ? (<><svg viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:32,height:32,marginBottom:8}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p style={{color:'#c0392b',fontWeight:500}}>파일을 읽을 수 없습니다</p><span>다시 시도해 주세요</span></>)
          : fileName ? (<><svg viewBox="0 0 24 24" fill="none" stroke="#1a8a4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:30,height:30,marginBottom:6}}><polyline points="20 6 9 17 4 12"/></svg><p style={{color:'#1a8a4a',fontWeight:500}}>{fileName}</p><span>탭하여 재업로드</span></>)
          : (<><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:34,height:34,marginBottom:8,stroke:'#9ea3b0'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><p>계정별원장 엑셀 업로드</p><span>xlsx · xls · csv · 드래그 또는 탭</span></>)}
        </div>
      </div>

      {parsedData && (<>

        {/* ── 집계기준 버튼 바 ── */}
        {(() => {
          const skip = ['년월','연월','회계연월','회계일','기표일','기표번호','전표번호','사업자번호','금액','차변','대변','잔액']
          const candidates = columns
            .filter(col => !skip.some(k=>col.includes(k)))
            .map(col => ({col, uniq: getUniqCount(rawRows,col)}))
            .sort((a,b)=>a.uniq-b.uniq).slice(0,5).map(c=>c.col)
          return (
            <div className={styles.groupBar}>
              <span className={styles.groupBarLbl}>집계기준</span>
              <div className={styles.groupBarBtns}>
                {candidates.map(col=>(
                  <button key={col}
                    className={`${styles.groupBarBtn} ${groupCol===col?styles.groupBarBtnOn:''}`}
                    onClick={()=>changeGroupCol(col)}>{col}</button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── Month tabs ── */}
        <div className={styles.monthScroll}>
          {months.map(m=>{
            const yr=m.slice(0,4), mo=parseInt(m.slice(4))
            return <button key={m} className={`${styles.mtab} ${m===activeMonth?styles.mtabOn:''}`} onClick={()=>setActiveMonth(m)}>{yr}.{String(mo).padStart(2,'0')}</button>
          })}
        </div>

        {/* ════════════════════════════
            비교 테이블
        ════════════════════════════ */}
        <div className={styles.cmpWrap}>

          {/* 테이블 헤더 */}
          <div className={styles.cmpHdr}>
            {/* 컬럼 선택 탭 */}
            <div className={styles.cmpColTabs}>
              {[['sales','매출'],['purchase','매입'],['profit','손익'],['chg','증감']].map(([k,l])=>(
                <button key={k} className={`${styles.cmpColTab} ${viewCol===k?styles.cmpColTabOn:''}`} onClick={()=>setViewCol(k)}>{l}</button>
              ))}
            </div>
            {/* 월 레이블 */}
            <div className={styles.cmpMonths}>
              {prevMonth && <span className={styles.cmpMoLbl}>{fmtMo(prevMonth)}</span>}
              <span className={`${styles.cmpMoLbl} ${styles.cmpMoCur}`}>{fmtMo(activeMonth)}</span>
              {viewCol==='chg' && prevMonth && <span className={styles.cmpMoLbl} style={{color:'#9ea3b0'}}>증감률</span>}
            </div>
          </div>

          {/* 유형별 행 */}
          <div className={styles.cmpBody}>
            {compareRows.map((row, idx) => {
              const [dot] = getPalette(idx)
              const curVal  = row.cur[viewCol==='chg'?'profit':viewCol] ?? row.cur.profit
              const prevVal = row.prev ? (row.prev[viewCol==='chg'?'profit':viewCol] ?? row.prev.profit) : null
              const chgVal  = viewCol==='chg' ? row.chgProfit : null
              const isNeg = curVal < 0

              return (
                <div key={row.type} className={styles.cmpRow} onClick={()=>setDrawer(row.type)}>
                  {/* 유형명 */}
                  <div className={styles.cmpRowName}>
                    <div className={styles.cmpDot} style={{background:dot}}/>
                    <span className={styles.cmpTypeName}>{row.type}</span>
                  </div>
                  {/* 전월값 */}
                  <div className={`${styles.cmpCell} ${styles.cmpCellPrev}`}>
                    {prevVal != null ? fmt(prevVal) : <span className={styles.cmpDash}>-</span>}
                  </div>
                  {/* 당월값 */}
                  <div className={`${styles.cmpCell} ${styles.cmpCellCur} ${isNeg?styles.neg:''}`}>
                    {fmt(curVal)}
                  </div>
                  {/* 증감률 (chg 탭일 때만) */}
                  {viewCol==='chg' && prevMonth && (
                    <div className={`${styles.cmpCell} ${styles.cmpCellChg}`}>
                      {chgVal != null
                        ? <span className={parseFloat(chgVal)>=0?styles.chgPos:styles.chgNeg}>
                            {parseFloat(chgVal)>=0?'▲':'▼'}{Math.abs(chgVal)}%
                          </span>
                        : <span className={styles.cmpDash}>신규</span>}
                    </div>
                  )}
                  <div className={styles.cmpArrow}>›</div>
                </div>
              )
            })}

            {/* 합계행 */}
            <div className={`${styles.cmpRow} ${styles.cmpRowTotal}`}>
              <div className={styles.cmpRowName}>
                <div className={styles.cmpDot} style={{background:'#111318'}}/>
                <span className={styles.cmpTypeName}>합 계</span>
              </div>
              <div className={`${styles.cmpCell} ${styles.cmpCellPrev}`}>
                {totPrev ? fmt(totPrev[viewCol==='chg'?'profit':viewCol]??totPrev.profit) : <span className={styles.cmpDash}>-</span>}
              </div>
              <div className={`${styles.cmpCell} ${styles.cmpCellCur} ${(totCur[viewCol==='chg'?'profit':viewCol]??totCur.profit)<0?styles.neg:''}`}>
                {fmt(totCur[viewCol==='chg'?'profit':viewCol]??totCur.profit)}
              </div>
              {viewCol==='chg' && prevMonth && (
                <div className={`${styles.cmpCell} ${styles.cmpCellChg}`}>
                  {totPrev ? (() => {
                    const cv = totCur.profit, pv = totPrev.profit
                    const pc = pctChg(cv,pv)
                    return pc!=null ? <span className={parseFloat(pc)>=0?styles.chgPos:styles.chgNeg}>{parseFloat(pc)>=0?'▲':'▼'}{Math.abs(pc)}%</span> : '-'
                  })() : '-'}
                </div>
              )}
              <div className={styles.cmpArrow}/>
            </div>
          </div>
        </div>

      </>)}

      {/* ════════════════════════════════
          상세 드로어
      ════════════════════════════════ */}
      <div className={`${styles.overlay} ${drawer?styles.overlayOn:''}`} onClick={()=>setDrawer(null)}/>
      <div className={`${styles.drawer} ${drawer?styles.drawerOpen:''}`}>
        <div className={styles.dHandle}/>
        {drawerRow && (<>
          <div className={styles.dHdr}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:getPalette(drawerIdx)[0],flexShrink:0}}/>
                <span className={styles.dTitle}>{drawerRow.type}</span>
              </div>
              <div style={{fontSize:11,color:'#9ea3b0',marginTop:3,paddingLeft:18}}>{groupCol} 기준</div>
            </div>
            <button className={styles.dClose} onClick={()=>setDrawer(null)}>✕</button>
          </div>
          <div className={styles.dBody}>

            {/* 당월 vs 전월 비교 카드 */}
            <div className={styles.dCmpGrid}>
              {[
                ['매출', drawerRow.cur.sales, drawerRow.prev?.sales, drawerRow.chgSales, true],
                ['매입', drawerRow.cur.purchase, drawerRow.prev?.purchase, drawerRow.chgPurchase, false],
                ['손익', drawerRow.cur.profit, drawerRow.prev?.profit, drawerRow.chgProfit, true],
              ].map(([lbl, cv, pv, chg, posGood])=>(
                <div className={styles.dCmpCard} key={lbl}>
                  <div className={styles.dCmpLbl}>{lbl}</div>
                  <div className={`${styles.dCmpCur} ${cv<0?styles.neg:lbl==='손익'?styles.pos:''}`}>{fmt(cv)}</div>
                  {pv!=null && <div className={styles.dCmpPrev}>{fmtMo(prevMonth)} {fmt(pv)}</div>}
                  {chg!=null && (
                    <div className={`${styles.dCmpChg} ${parseFloat(chg)>=0?(posGood?styles.chgPos:styles.chgNeg):(posGood?styles.chgNeg:styles.chgPos)}`}>
                      {parseFloat(chg)>=0?'▲':'▼'} {Math.abs(chg)}%
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 월별 막대 (매출) */}
            {drawerRow.prev && (() => {
              const maxV = Math.max(drawerRow.cur.sales, drawerRow.prev.sales, 1)
              return (<>
                <div className={styles.dSec}>월별 매출 추이</div>
                {[[fmtMo(prevMonth), drawerRow.prev.sales, '#b3cefa'],[fmtMo(activeMonth), drawerRow.cur.sales, getPalette(drawerIdx)[0]]].map(([lbl,val,color])=>(
                  <div className={styles.barRow} key={lbl}>
                    <span className={styles.barLbl}>{lbl}</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{width:Math.round(val/maxV*100)+'%',background:color}}/></div>
                    <span className={styles.barNum}>{fmt(val)}</span>
                  </div>
                ))}
              </>)
            })()}

            {/* 전월 상세 수치 */}
            {drawerRow.prev && (<>
              <div className={styles.dSec}>전월 ({fmtMo(prevMonth)}) 상세</div>
              {[['매출',fmtFull(drawerRow.prev.sales),''],['매입',fmtFull(drawerRow.prev.purchase),''],['손익',fmtFull(drawerRow.prev.profit),drawerRow.prev.profit>=0?'pos':'neg'],['거래건수',drawerRow.prev.count.toLocaleString()+'건','']].map(([l,v,c])=>(
                <div className={styles.dRow} key={l}>
                  <span className={styles.dRowL}>{l}</span>
                  <span className={`${styles.dRowV} ${c?styles[c]:''}`}>{v}</span>
                </div>
              ))}
            </>)}

            {/* 당월 거래내역 */}
            {drawerRow.cur.items?.length>0 && (<>
              <div className={styles.dSec}>당월 거래내역 ({fmtMo(activeMonth)})</div>
              {drawerRow.cur.items.slice(0,8).map((it,i)=>{
                const amt = parseFloat(String(it['차변금액']||it['대변금액']||0).replace(/[^0-9.-]/g,''))||0
                const desc = String(it['적요']||'').slice(0,32)||'-'
                const party = String(it['거래처']||'')
                const date = String(it['회계일']||it['기표일']||'').slice(5,10)
                return (
                  <div className={styles.txItem} key={i}>
                    <div className={styles.txDesc}>{desc}</div>
                    <div className={styles.txSub}>
                      <span className={styles.txParty}>{party}{date?` · ${date}`:''}</span>
                      <span className={styles.txAmt}>{fmt(amt)}</span>
                    </div>
                  </div>
                )
              })}
            </>)}
          </div>
        </>)}
      </div>
    </div>
  )
}
