import { NextRequest } from 'next/server'
import { ROLES, RoleKey } from '@/lib/prompts'
import { queryVectorStore, queryConversationHistory } from '@/lib/vectorStore'

interface ChatItem {
  question: string
  answer: string
}

const RAG_ROLES: RoleKey[] = ['mipha', 'zelda', 'link', 'daruk', 'urbosa', 'revali']

export async function POST(req: NextRequest) {
  const { message, role = 'general', history = [] } = await req.json() as { 
    message: string
    role?: RoleKey
    history?: ChatItem[]
  }
  let systemPrompt = ROLES[role]?.prompt || ROLES.general.prompt

  if (RAG_ROLES.includes(role)) {
    const [archiveResults, historyResults] = await Promise.all([
      queryVectorStore(message, 3, { id: role }),
      queryConversationHistory(message, role, 3)
    ])
    if (archiveResults.length > 0) {
      const context = archiveResults.map(r => r.text).join('\n\n')
      systemPrompt += `\n\n【相关记忆档案】\n${context}`
    }
    if (historyResults.length > 0) {
      const historyContext = historyResults.map(r => `用户曾问：${r.question}\n你曾答：${r.answer}`).join('\n\n')
      systemPrompt += `\n\n【历史对话记忆】\n${historyContext}`
    }
    if (archiveResults.length > 0 || historyResults.length > 0) {
      systemPrompt += `\n\n请基于以上记忆回答，保持角色一致性。`
    }
  }

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt }
  ]
  
  const recentHistory = history.slice(-5)
  for (const item of recentHistory) {
    messages.push({ role: 'user', content: item.question })
    messages.push({ role: 'assistant', content: item.answer })
  }
  messages.push({ role: 'user', content: message })
  
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-SSE': 'enable',
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      input: { messages },
      parameters: {
        incremental_output: true
      }
    })
  })

  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

