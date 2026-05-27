import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

const DATA_PATH = '/tmp/sales_data.json'
const META_PATH = '/tmp/sales_meta.json'

export async function GET() {
  try {
    if (!existsSync(DATA_PATH) || !existsSync(META_PATH)) {
      return NextResponse.json({ ok: false, message: 'no_data' })
    }
    const [dataRaw, metaRaw] = await Promise.all([
      readFile(DATA_PATH, 'utf-8'),
      readFile(META_PATH, 'utf-8'),
    ])
    return NextResponse.json({
      ok: true,
      data: JSON.parse(dataRaw),
      meta: JSON.parse(metaRaw),
    })
  } catch {
    return NextResponse.json({ ok: false, message: 'read_error' })
  }
}
