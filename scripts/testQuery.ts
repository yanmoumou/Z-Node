import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { queryVectorStore } from '../src/lib/vectorStore'

async function main() {
  const role = process.argv[2] || 'link'
  const query = process.argv[3] || '你是谁'
  
  console.log(`查询角色: ${role}`)
  console.log(`查询内容: ${query}`)
  console.log('---')
  
  const results = await queryVectorStore(query, 3, { id: role })
  
  if (results.length === 0) {
    console.log('❌ 没有找到任何结果！向量库中可能没有该角色的档案。')
  } else {
    console.log(`✅ 找到 ${results.length} 条结果：\n`)
    results.forEach((r, i) => {
      console.log(`[${i + 1}] 相似度: ${r.score?.toFixed(4)}`)
      console.log(`内容: ${r.text?.slice(0, 200)}...`)
      console.log('---')
    })
  }
}

main().catch(console.error)
