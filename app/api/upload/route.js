import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import * as XLSX from 'xlsx'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const SECRET = process.env.JWT_SECRET || 'sales-app-secret-2024'
const DATA_PATH = '/tmp/sales_data.json'
const META_PATH = '/tmp/sales_meta.json'

function verifyAdmin(req) {
  try {
    const token = req.cookies.get('auth_token')?.value
    if (!token) return false
    const payload = jwt.verify(token, SECRET)
    return payload.role === 'admin'
  } catch { return false }
}

function parseRows(rows) {
  const data = {}
  rows.forEach(r => {
    const ymRaw = String(r['년월']||r['연월']||r['회계연월']||'').replace(/[^0-9]/g,'')
    const ym = ymRaw.length>=6 ? ymRaw.slice(0,6) : ymRaw.length===4 ? ymRaw+'01' : ''
    if (!ym) return
    const acct = String(r['계정명']||r['계정']||'').trim()
    if (!acct) return
    const debit  = parseFloat(String(r['차변금액']||r['차변']||0).replace(/[^0-9.-]/g,''))||0
    const credit = parseFloat(String(r['대변금액']||r['대변']||0).replace(/[^0-9.-]/g,''))||0
    const acctCode = String(r['계정코드']||'')
    if (!data[ym]) data[ym]={}
    if (!data[ym][acct]) data[ym][acct]={sales:0,purchase:0,count:0,items:[]}
    if (acctCode.startsWith('4')||acct.includes('매출')||acct.includes('수익')) {
      data[ym][acct].sales += credit||debit
    } else {
      data[ym][acct].purchase += debit
    }
    data[ym][acct].count++
    if (data[ym][acct].items.length<5) data[ym][acct].items.push({
      적요: String(r['적요']||''),
      거래처: String(r['거래처']||''),
      회계일: String(r['회계일']||r['기표일']||''),
      차변금액: debit,
      대변금액: credit,
    })
  })
  return data
}

export async function POST(req) {
  if (!verifyAdmin(req)) return NextResponse.json({ ok:false, message:'권한 없음' }, { status:403 })
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ ok:false, message:'파일 없음' }, { status:400 })

    const bytes = await file.arrayBuffer()
    const wb = XLSX.read(bytes, { type:'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval:'' })
    if (!rows.length) throw new Error('empty')

    // 전체 컬럼 추출
    const columns = Object.keys(rows[0])

    // 기본 집계 (계정명)
    const defaultCol = columns.includes('계정명') ? '계정명' : columns[0]
    const parsedData = parseRows(rows)

    // 모든 집계 가능 컬럼별 데이터도 미리 저장
    const skipKeywords = ['년월','연월','회계연월','회계일','기표일','기표번호','전표번호','사업자번호','금액','차변','대변','잔액']
    const candidates = columns
      .filter(col => !skipKeywords.some(k=>col.includes(k)))
      .map(col => {
        const uniq = new Set(rows.map(r=>String(r[col]||'').trim()).filter(Boolean)).size
        return { col, uniq }
      })
      .sort((a,b)=>a.uniq-b.uniq)
      .slice(0,5)
      .map(c=>c.col)

    const allGroupData = {}
    candidates.forEach(col => {
      allGroupData[col] = parseRowsByCol(rows, col)
    })

    const meta = {
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      columns,
      candidates,
      defaultCol,
      totalRows: rows.length,
    }

    await writeFile(DATA_PATH, JSON.stringify(allGroupData))
    await writeFile(META_PATH, JSON.stringify(meta))

    return NextResponse.json({ ok:true, meta })
  } catch(e) {
    return NextResponse.json({ ok:false, message: e.message }, { status:500 })
  }
}

function parseRowsByCol(rows, groupCol) {
  const data = {}
  rows.forEach(r => {
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
    if (data[ym][group].items.length<5) data[ym][group].items.push({
      적요: String(r['적요']||''),
      거래처: String(r['거래처']||''),
      회계일: String(r['회계일']||r['기표일']||''),
      차변금액: debit,
      대변금액: credit,
    })
  })
  return data
}
