'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './styles.module.css'

/* ─── 팔레트 ─── */
const PALETTE = [
  ['#1a6ef5','#e8f0fe','#1a3a8f'],['#1a8a4a','#e6f4ec','#145a32'],
  ['#7c3aed','#f3e8ff','#4c1d95'],['#d97706','#fef3c7','#78350f'],
  ['#c2410c','#ffedd5','#7c2d12'],['#be185d','#fce7f3','#831843'],
  ['#0891b2','#e0f2fe','#0c4a6e'],['#65a30d','#f7fee7','#365314'],
  ['#6b7280','#f3f4f6','#374151'],['#9333ea','#faf5ff','#581c87'],
]
function getPalette(idx) { return PALETTE[idx % PALETTE.length] }

function fmt(n) {
  if (n==null) return '-'
  const a=Math.abs(n)
  if (a>=100000000) return (n/100000000).toFixed(1)+'억'
  if (a>=10000000)  return Math.round(n/10000000)+'천만'
  if (a>=10000)     return Math.round(n/10000)+'만'
  return n.toLocaleString()
}
function fmtFull(n) { return Math.round(n).toLocaleString()+'원' }
function pctChg(a,b) { if(!b) return null; return ((a-b)/Math.abs(b)*100).toFixed(1) }
function fmtMo(ym) { return ym ? `${ym.slice(0,4)}.${ym.slice(4)}` : '-' }

function buildCompareRows(mData, prevData, types) {
  return types.map(type => {
    const c = mData[type]     || {sales:0,purchase:0,count:0,items:[]}
    const p = prevData?.[type] || null
    const cP=c.sales-c.purchase, pP=p?p.sales-p.purchase:null
    return {
      type,
      cur:  {sales:c.sales, purchase:c.purchase, profit:cP, count:c.count, items:c.items||[]},
      prev: p ? {sales:p.sales, purchase:p.purchase, profit:pP, count:p.count, items:p.items||[]} : null,
      chgSales:   p?pctChg(c.sales,p.sales):null,
      chgPurchase:p?pctChg(c.purchase,p.purchase):null,
      chgProfit:  p?pctChg(cP,pP):null,
    }
  })
}

/* ════════════════════════════════
   로그인 화면
════════════════════════════════ */
function LoginModal({ onClose }) {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!id||!pw) { setErr('아이디와 비밀번호를 입력해 주세요.'); return }
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/auth', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({id, password:pw})
      })
      const json = await res.json()
      if (json.ok) { onClose(true) }
      else { setErr(json.message||'로그인 실패'); setLoading(false) }
    } catch { setErr('네트워크 오류'); setLoading(false) }
  }

  return (
    <div className={styles.modalBack} onClick={()=>onClose(false)}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <div className={styles.modalIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 className={styles.modalTitle}>관리자 로그인</h2>
        <p className={styles.modalSub}>엑셀 업로드 권한이 필요합니다</p>
        <input className={styles.modalInput} placeholder="아이디" value={id}
          onChange={e=>setId(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}/>
        <input className={styles.modalInput} placeholder="비밀번호" type="password" value={pw}
          onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}/>
        {err && <p className={styles.modalErr}>{err}</p>}
        <button className={styles.modalBtn} onClick={submit} disabled={loading}>
          {loading ? '확인 중...' : '로그인'}
        </button>
        <button className={styles.modalCancel} onClick={()=>onClose(false)}>취소</button>
      </div>
    </div>
  )
}

/* ─── 클라이언트에서 엑셀 파싱 (관리자 즉시 미리보기용) ─── */
async function parseFileClient(file) {
  const XLSX = (await import('xlsx')).default || await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, {type:'array'})
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, {defval:''})
  if (!rows.length) throw new Error('empty')
  const columns = Object.keys(rows[0])
  const skipKeywords = ['년월','연월','회계연월','회계일','기표일','기표번호','전표번호','사업자번호','금액','차변','대변','잔액']
  const candidates = columns
    .filter(col => !skipKeywords.some(k=>col.includes(k)))
    .map(col => {const u=new Set(rows.map(r=>String(r[col]||'').trim()).filter(Boolean)).size; return {col,u}})
    .sort((a,b)=>a.u-b.u).slice(0,5).map(c=>c.col)
  const allGroupData = {}
  candidates.forEach(col => { allGroupData[col] = parseRowsByCol(rows, col) })
  return { allGroupData, meta: { fileName:file.name, uploadedAt:new Date().toISOString(), columns, candidates, defaultCol:candidates[0]||columns[0], totalRows:rows.length } }
}

function parseRowsByCol(rows, groupCol) {
  const data = {}
  rows.forEach(r => {
    const ymRaw = String(r['년월']||r['연월']||r['회계연월']||'').replace(/[^0-9]/g,'')
    const ym = ymRaw.length>=6?ymRaw.slice(0,6):ymRaw.length===4?ymRaw+'01':''
    if (!ym) return
    const group = String(r[groupCol]||'(미지정)').trim()||'(미지정)'
    const debit  = parseFloat(String(r['차변금액']||r['차변']||0).replace(/[^0-9.-]/g,''))||0
    const credit = parseFloat(String(r['대변금액']||r['대변']||0).replace(/[^0-9.-]/g,''))||0
    const acctCode = String(r['계정코드']||''), acctName = String(r['계정명']||'')
    if (!data[ym]) data[ym]={}
    if (!data[ym][group]) data[ym][group]={sales:0,purchase:0,count:0,items:[]}
    if (acctCode.startsWith('4')||acctName.includes('매출')||acctName.includes('수익')) {
      data[ym][group].sales += credit||debit
    } else { data[ym][group].purchase += debit }
    data[ym][group].count++
    if (data[ym][group].items.length<5) data[ym][group].items.push({
      적요:String(r['적요']||''), 거래처:String(r['거래처']||''),
      회계일:String(r['회계일']||r['기표일']||''), 차변금액:debit, 대변금액:credit,
    })
  })
  return data
}

function applyData(allGroupData, meta, setAllData, setMeta, setGroupCol, setActiveMonth) {
  setAllData(allGroupData)
  setMeta(meta)
  const firstCol = meta.candidates?.[0] || meta.defaultCol
  setGroupCol(firstCol)
  const ms = Object.keys(allGroupData[firstCol]||{}).sort()
  setActiveMonth(ms[ms.length-1]||null)
}

/* ════════════════════════════════
   메인 앱
════════════════════════════════ */
export default function SalesApp() {
  const [role, setRole]               = useState(null)   // null|'guest'|'admin'
  const [initDone, setInitDone]       = useState(false)  // 초기 로딩 완료
  const [showLogin, setShowLogin]     = useState(false)
  const [allData, setAllData]         = useState(null)
  const [meta, setMeta]               = useState(null)
  const [groupCol, setGroupCol]       = useState(null)
  const [activeMonth, setActiveMonth] = useState(null)
  const [viewCol, setViewCol]         = useState('sales')
  const [drawer, setDrawer]           = useState(null)
  const [uploading, setUploading]     = useState(false)
  const [uploadStatus, setUploadStatus] = useState('idle') // 'idle'|'uploading'|'done'|'error'
  const [uploadMsg, setUploadMsg]     = useState('')
  const [dragging, setDragging]       = useState(false)
  const [noDataAlert, setNoDataAlert] = useState(false)
  const fileInputRef = useRef()

  /* ── 초기: role 확인 + 서버 데이터 로드 ── */
  useEffect(() => {
    const init = async () => {
      const [authRes, dataRes] = await Promise.all([
        fetch('/api/auth').then(r=>r.json()).catch(()=>({role:'guest'})),
        fetch('/api/data').then(r=>r.json()).catch(()=>({ok:false})),
      ])
      const userRole = authRes.role || 'guest'
      setRole(userRole)
      if (dataRes.ok) {
        applyData(dataRes.data, dataRes.meta, setAllData, setMeta, setGroupCol, setActiveMonth)
      } else {
        // 데이터 없음 → 알림
        setNoDataAlert(true)
      }
      setInitDone(true)
    }
    init()
  }, [])

  /* ── 로그인/로그아웃 ── */
  const handleLoginClose = (success) => {
    setShowLogin(false)
    if (success) setRole('admin')
  }
  const logout = async () => {
    await fetch('/api/auth', {method:'DELETE'})
    setRole('guest')
  }

  /* ── 파일 업로드: 클라이언트 파싱으로 즉시 표시 + 백그라운드 서버 저장 ── */
  const handleFile = useCallback(async (file) => {
    if (!file || role!=='admin') return
    setUploadStatus('uploading'); setUploadMsg(''); setNoDataAlert(false)
    try {
      // 1) 클라이언트 파싱 → 즉시 화면 표시
      const {allGroupData, meta: newMeta} = await parseFileClient(file)
      applyData(allGroupData, newMeta, setAllData, setMeta, setGroupCol, setActiveMonth)
      setUploadStatus('done')
      setUploadMsg(`${newMeta.fileName} · ${newMeta.totalRows.toLocaleString()}건 로드 완료`)

      // 2) 백그라운드로 서버에도 저장
      const fd = new FormData(); fd.append('file', file)
      fetch('/api/upload', {method:'POST', body:fd}).catch(()=>{})
    } catch (e) {
      setUploadStatus('error')
      setUploadMsg('파일을 읽을 수 없습니다. 형식을 확인해 주세요.')
    }
  }, [role])

  const onFileChange = (e) => { handleFile(e.target.files[0]); e.target.value='' }
  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }

  /* ── 집계기준 변경 ── */
  const changeGroupCol = (col) => {
    setGroupCol(col); setDrawer(null)
    const months = Object.keys(allData[col]||{}).sort()
    setActiveMonth(months[months.length-1]||null)
  }

  /* ── 데이터 계산 ── */
  const parsedData = allData && groupCol ? allData[groupCol]||{} : {}
  const months = Object.keys(parsedData).sort()
  const mData  = activeMonth ? parsedData[activeMonth]||{} : {}
  const prevMonth = activeMonth ? months[months.indexOf(activeMonth)-1] : null
  const prevData  = prevMonth ? parsedData[prevMonth]||{} : null

  const allTypes = [...new Set([...Object.keys(mData), ...(prevData?Object.keys(prevData):[]) ])].sort((a,b)=>(mData[b]?.sales||0)-(mData[a]?.sales||0))
  const compareRows = buildCompareRows(mData, prevData, allTypes)
  const totCur  = compareRows.reduce((a,r)=>({sales:a.sales+r.cur.sales, purchase:a.purchase+r.cur.purchase, profit:a.profit+r.cur.profit}),{sales:0,purchase:0,profit:0})
  const totPrev = prevData ? compareRows.reduce((a,r)=>r.prev?{sales:a.sales+r.prev.sales,purchase:a.purchase+r.prev.purchase,profit:a.profit+r.prev.profit}:a,{sales:0,purchase:0,profit:0}) : null

  const drawerRow = drawer ? compareRows.find(r=>r.type===drawer) : null
  const drawerIdx = drawer ? allTypes.indexOf(drawer) : 0

  const getVal = (obj, col) => col==='chg' ? obj?.profit : obj?.[col] ?? 0

  if (!initDone) return (
    <div className={styles.app}>
      <div className={styles.initLoader}>
        <div className={styles.spinner}/>
        <p>데이터 불러오는 중...</p>
      </div>
    </div>
  )

  return (
    <div className={styles.app}>

      {/* ── Header ── */}
      <header className={styles.hdr}>
        <div>
          <h1 className={styles.hdrTitle}>매출매입 분석</h1>
          <p className={styles.hdrSub}>
            {meta
              ? `${meta.fileName} · ${new Date(meta.uploadedAt).toLocaleDateString('ko')} 업로드`
              : role==='admin' ? '엑셀을 업로드해 주세요' : '데이터 없음'}
          </p>
        </div>
        {role==='admin' ? (
          <button className={styles.adminBadge} onClick={logout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            관리자
          </button>
        ) : (
          <button className={styles.loginBtn} onClick={()=>setShowLogin(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}>
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            관리자
          </button>
        )}
      </header>

      {/* ── 관리자 업로드 영역 ── */}
      {role==='admin' && (
        <div className={styles.uploadWrap}>
          <div
            className={`${styles.uploadZone} ${dragging?styles.uploadDrag:''} ${uploadStatus==='done'?styles.uploadDone:''} ${uploadStatus==='error'?styles.uploadError:''}`}
            onDragOver={(e)=>{e.preventDefault();setDragging(true)}}
            onDragLeave={()=>setDragging(false)}
            onDrop={onDrop}
            onClick={()=>fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} style={{display:'none'}}/>
            {uploadStatus==='uploading' ? (
              <><div className={styles.spinner}/><p style={{color:'#1a6ef5',fontWeight:500}}>파일 분석 중...</p><span>잠시만 기다려 주세요</span></>
            ) : uploadStatus==='done' ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="#1a8a4a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:28,height:28,marginBottom:6}}><polyline points="20 6 9 17 4 12"/></svg>
                <p style={{color:'#1a8a4a',fontWeight:600}}>{uploadMsg}</p>
                <span>탭하여 새 파일로 교체</span>
              </>
            ) : uploadStatus==='error' ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:28,height:28,marginBottom:6}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p style={{color:'#c0392b',fontWeight:500}}>{uploadMsg}</p>
                <span>탭하여 다시 시도</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width:32,height:32,marginBottom:8,stroke:'#9ea3b0'}}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p>계정별원장 엑셀 업로드</p>
                <span>xlsx · xls · csv · 드래그 또는 탭</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 데이터 없음 알림 ── */}
      {noDataAlert && !allData && (
        <div className={styles.noDataAlert}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:22,height:22,flexShrink:0}}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <p className={styles.noDataAlertTitle}>업로드된 데이터가 없습니다</p>
            {role==='admin'
              ? <p className={styles.noDataAlertSub}>위 업로드 영역에 엑셀 파일을 올려주세요.</p>
              : <p className={styles.noDataAlertSub}>관리자가 로그인하여 엑셀을 업로드하면 여기서 조회할 수 있습니다.</p>
            }
          </div>
          {role!=='admin' && (
            <button className={styles.noDataLoginBtn} onClick={()=>setShowLogin(true)}>관리자 로그인</button>
          )}
        </div>
      )}

      {allData && meta && (<>

        {/* ── 집계기준 버튼 바 ── */}
        <div className={styles.groupBar}>
          <span className={styles.groupBarLbl}>집계기준</span>
          <div className={styles.groupBarBtns}>
            {(meta.candidates||[]).map(col=>(
              <button key={col}
                className={`${styles.groupBarBtn} ${groupCol===col?styles.groupBarBtnOn:''}`}
                onClick={()=>changeGroupCol(col)}>{col}
              </button>
            ))}
          </div>
        </div>

        {/* ── Month tabs ── */}
        <div className={styles.monthScroll}>
          {months.map(m=>(
            <button key={m} className={`${styles.mtab} ${m===activeMonth?styles.mtabOn:''}`} onClick={()=>setActiveMonth(m)}>
              {m.slice(0,4)}.{m.slice(4)}
            </button>
          ))}
        </div>

        {/* ── 비교 테이블 ── */}
        <div className={styles.cmpWrap}>
          <div className={styles.cmpHdr}>
            <div className={styles.cmpColTabs}>
              {[['sales','매출'],['purchase','매입'],['profit','손익'],['chg','증감']].map(([k,l])=>(
                <button key={k} className={`${styles.cmpColTab} ${viewCol===k?styles.cmpColTabOn:''}`} onClick={()=>setViewCol(k)}>{l}</button>
              ))}
            </div>
            <div className={styles.cmpMonths}>
              {prevMonth && <span className={styles.cmpMoLbl}>{fmtMo(prevMonth)}</span>}
              <span className={`${styles.cmpMoLbl} ${styles.cmpMoCur}`}>{fmtMo(activeMonth)}</span>
              {viewCol==='chg'&&prevMonth && <span className={styles.cmpMoLbl} style={{color:'#9ea3b0'}}>증감률</span>}
            </div>
          </div>

          <div className={styles.cmpBody}>
            {compareRows.map((row,idx)=>{
              const [dot]=getPalette(idx)
              const curVal  = getVal(row.cur, viewCol)
              const prevVal = row.prev ? getVal(row.prev, viewCol) : null
              const chgVal  = viewCol==='chg' ? row.chgProfit : null
              return (
                <div key={row.type} className={styles.cmpRow} onClick={()=>setDrawer(row.type)} style={{animationDelay:`${idx*30}ms`}}>
                  <div className={styles.cmpRowName}>
                    <div className={styles.cmpDot} style={{background:dot}}/>
                    <span className={styles.cmpTypeName}>{row.type}</span>
                  </div>
                  <div className={`${styles.cmpCell} ${styles.cmpCellPrev}`}>
                    {prevVal!=null ? fmt(prevVal) : <span className={styles.cmpDash}>-</span>}
                  </div>
                  <div className={`${styles.cmpCell} ${styles.cmpCellCur} ${curVal<0?styles.neg:''}`}>
                    {fmt(curVal)}
                  </div>
                  {viewCol==='chg'&&prevMonth&&(
                    <div className={`${styles.cmpCell} ${styles.cmpCellChg}`}>
                      {chgVal!=null
                        ? <span className={parseFloat(chgVal)>=0?styles.chgPos:styles.chgNeg}>{parseFloat(chgVal)>=0?'▲':'▼'}{Math.abs(chgVal)}%</span>
                        : <span className={styles.cmpDash}>신규</span>}
                    </div>
                  )}
                  <div className={styles.cmpArrow}>›</div>
                </div>
              )
            })}

            {/* 합계 */}
            <div className={`${styles.cmpRow} ${styles.cmpRowTotal}`}>
              <div className={styles.cmpRowName}>
                <div className={styles.cmpDot} style={{background:'#111318'}}/>
                <span className={styles.cmpTypeName}>합 계</span>
              </div>
              <div className={`${styles.cmpCell} ${styles.cmpCellPrev}`}>
                {totPrev ? fmt(getVal(totPrev,viewCol)) : <span className={styles.cmpDash}>-</span>}
              </div>
              <div className={`${styles.cmpCell} ${styles.cmpCellCur} ${getVal(totCur,viewCol)<0?styles.neg:''}`}>
                {fmt(getVal(totCur,viewCol))}
              </div>
              {viewCol==='chg'&&prevMonth&&(
                <div className={`${styles.cmpCell} ${styles.cmpCellChg}`}>
                  {totPrev ? (() => {
                    const pc=pctChg(totCur.profit,totPrev.profit)
                    return pc ? <span className={parseFloat(pc)>=0?styles.chgPos:styles.chgNeg}>{parseFloat(pc)>=0?'▲':'▼'}{Math.abs(pc)}%</span> : '-'
                  })() : '-'}
                </div>
              )}
              <div className={styles.cmpArrow}/>
            </div>
          </div>
        </div>
      </>)}

      {/* ── 로그인 모달 ── */}
      {showLogin && <LoginModal onClose={handleLoginClose}/>}

      {/* ── 상세 드로어 ── */}
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
            <div className={styles.dCmpGrid}>
              {[['매출',drawerRow.cur.sales,drawerRow.prev?.sales,drawerRow.chgSales,true],
                ['매입',drawerRow.cur.purchase,drawerRow.prev?.purchase,drawerRow.chgPurchase,false],
                ['손익',drawerRow.cur.profit,drawerRow.prev?.profit,drawerRow.chgProfit,true]].map(([lbl,cv,pv,chg,posGood])=>(
                <div className={styles.dCmpCard} key={lbl}>
                  <div className={styles.dCmpLbl}>{lbl}</div>
                  <div className={`${styles.dCmpCur} ${cv<0?styles.neg:lbl==='손익'?styles.pos:''}`}>{fmt(cv)}</div>
                  {pv!=null && <div className={styles.dCmpPrev}>{fmtMo(prevMonth)} {fmt(pv)}</div>}
                  {chg!=null && <div className={`${styles.dCmpChg} ${parseFloat(chg)>=0?(posGood?styles.chgPos:styles.chgNeg):(posGood?styles.chgNeg:styles.chgPos)}`}>{parseFloat(chg)>=0?'▲':'▼'} {Math.abs(chg)}%</div>}
                </div>
              ))}
            </div>

            {drawerRow.prev && (() => {
              const maxV=Math.max(drawerRow.cur.sales,drawerRow.prev.sales,1)
              return (<>
                <div className={styles.dSec}>월별 매출 추이</div>
                {[[fmtMo(prevMonth),drawerRow.prev.sales,'#b3cefa'],[fmtMo(activeMonth),drawerRow.cur.sales,getPalette(drawerIdx)[0]]].map(([lbl,val,color])=>(
                  <div className={styles.barRow} key={lbl}>
                    <span className={styles.barLbl}>{lbl}</span>
                    <div className={styles.barTrack}><div className={styles.barFill} style={{width:Math.round(val/maxV*100)+'%',background:color}}/></div>
                    <span className={styles.barNum}>{fmt(val)}</span>
                  </div>
                ))}
              </>)
            })()}

            {drawerRow.prev && (<>
              <div className={styles.dSec}>전월 ({fmtMo(prevMonth)}) 상세</div>
              {[['매출',fmtFull(drawerRow.prev.sales),''],['매입',fmtFull(drawerRow.prev.purchase),''],
                ['손익',fmtFull(drawerRow.prev.profit),drawerRow.prev.profit>=0?'pos':'neg'],
                ['거래건수',drawerRow.prev.count.toLocaleString()+'건','']].map(([l,v,c])=>(
                <div className={styles.dRow} key={l}>
                  <span className={styles.dRowL}>{l}</span>
                  <span className={`${styles.dRowV} ${c?styles[c]:''}`}>{v}</span>
                </div>
              ))}
            </>)}

            {drawerRow.cur.items?.length>0 && (<>
              <div className={styles.dSec}>당월 거래내역 ({fmtMo(activeMonth)})</div>
              {drawerRow.cur.items.slice(0,8).map((it,i)=>{
                const amt=parseFloat(String(it['차변금액']||it['대변금액']||0))||0
                const desc=String(it['적요']||'').slice(0,32)||'-'
                const party=String(it['거래처']||'')
                const date=String(it['회계일']||'').slice(5,10)
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
