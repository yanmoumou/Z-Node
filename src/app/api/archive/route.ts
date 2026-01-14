import { NextRequest, NextResponse } from 'next/server'
import { splitText, upsertToVectorStore, queryVectorStore } from '@/lib/vectorStore'

export async function POST(req: NextRequest) {
  const { action, content, id, type, query, filter } = await req.json()

  if (action === 'upload') {
    const chunks = await splitText(content, { id, type })
    const count = await upsertToVectorStore(chunks)
    return NextResponse.json({ success: true, chunks: count })
  }

  if (action === 'query') {
    const results = await queryVectorStore(query, 3, filter)
    return NextResponse.json({ results })
  }

  return NextResponse.json({ error: '无效操作' }, { status: 400 })
}

