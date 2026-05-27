import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'sales-app-secret-2024'
const ADMIN_ID = 'ds'
const ADMIN_PW = '0000'

export async function POST(req) {
  try {
    const { id, password } = await req.json()
    if (id === ADMIN_ID && password === ADMIN_PW) {
      const token = jwt.sign({ role: 'admin', id }, SECRET, { expiresIn: '8h' })
      const res = NextResponse.json({ ok: true, role: 'admin' })
      res.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 8
      })
      return res
    }
    return NextResponse.json({ ok: false, message: '아이디 또는 비밀번호가 틀렸습니다.' }, { status: 401 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('auth_token')
  return res
}

export async function GET(req) {
  try {
    const token = req.cookies.get('auth_token')?.value
    if (!token) return NextResponse.json({ role: 'guest' })
    const payload = jwt.verify(token, SECRET)
    return NextResponse.json({ role: payload.role, id: payload.id })
  } catch {
    return NextResponse.json({ role: 'guest' })
  }
}
