import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { splitText, upsertToVectorStore } from '../src/lib/vectorStore'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.log('用法: npx tsx scripts/uploadArchive.ts <档案路径>')
    process.exit(1)
  }

  const content = fs.readFileSync(path.resolve(filePath), 'utf-8')
  const fileName = path.basename(filePath, '.md')
  
  console.log(`正在分割文档: ${fileName}`)
  const chunks = await splitText(content, { id: fileName, type: 'character' })
  console.log(`分割成 ${chunks.length} 个块`)

  console.log('正在上传到向量库...')
  const count = await upsertToVectorStore(chunks)
  console.log(`成功上传 ${count} 个向量`)
}

main().catch(console.error)

