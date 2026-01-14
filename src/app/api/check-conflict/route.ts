import { NextRequest, NextResponse } from 'next/server'
import { queryVectorStore } from '@/lib/vectorStore'

export async function POST(req: NextRequest) {
  const { content, role } = await req.json() as { content: string; role: string }
  
  const relevantFacts = await queryVectorStore(content, 5, { id: role })
  
  if (relevantFacts.length === 0) {
    return NextResponse.json({ hasConflict: false, message: '无相关设定可供校验' })
  }

  const factsText = relevantFacts.map(f => f.text).join('\n\n')
  
  const checkPrompt = `你是一个塞尔达传说设定校验专家。请判断以下AI生成的内容是否与原作设定存在冲突。

【原作设定档案】
${factsText}

【待检测内容】
${content}

请严格按照以下JSON格式回复，不要添加任何其他内容：
{
  "hasConflict": true或false,
  "conflictDetails": "如果有冲突，说明哪里冲突；如果没有冲突，写'无冲突'",
  "suggestion": "如果有冲突，给出修改建议；如果没有冲突，写'无需修改'"
}`

  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      input: {
        messages: [
          { role: 'system', content: '你是设定校验专家，只输出JSON格式结果。' },
          { role: 'user', content: checkPrompt }
        ]
      }
    })
  })

  const data = await response.json()
  const resultText = data.output?.text || '{}'
  
  try {
    const jsonMatch = resultText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return NextResponse.json(result)
    }
  } catch {}
  
  return NextResponse.json({ hasConflict: false, message: '校验失败' })
}
