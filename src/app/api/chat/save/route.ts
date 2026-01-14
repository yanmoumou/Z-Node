import { NextRequest, NextResponse } from 'next/server'
import { saveConversation } from '@/lib/vectorStore'

export async function POST(req: NextRequest) {
  try {
    const { question, answer, role } = await req.json()
    if (!question || !answer || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    await saveConversation(question, answer, role)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Save conversation error:', e)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

