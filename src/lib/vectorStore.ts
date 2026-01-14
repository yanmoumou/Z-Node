import { Pinecone } from '@pinecone-database/pinecone'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

let pc: Pinecone | null = null
function getPinecone() {
  if (!pc) pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  return pc
}

function getIndex() {
  return getPinecone().index(process.env.PINECONE_INDEX!, process.env.PINECONE_HOST)
}

function filterMetadata(meta: Record<string, unknown>): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      result[k] = v
    }
  }
  return result
}

export async function splitText(text: string, metadata: Record<string, string>) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  })
  const docs = await splitter.createDocuments([text], [metadata])
  return docs.map((doc, i) => ({
    id: `${metadata.id}-${i}`,
    text: doc.pageContent,
    metadata: filterMetadata(doc.metadata),
  }))
}

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-v2',
      input: { texts: [text] },
      parameters: { text_type: 'document' }
    })
  })
  const data = await res.json()
  if (!data.output?.embeddings?.[0]?.embedding) {
    console.error('Embedding API error:', JSON.stringify(data, null, 2))
    throw new Error(`Embedding failed: ${data.message || 'Unknown error'}`)
  }
  return data.output.embeddings[0].embedding
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function upsertToVectorStore(chunks: { id: string; text: string; metadata: Record<string, string | number | boolean> }[]) {
  const index = getIndex()
  const vectors = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`Embedding ${i + 1}/${chunks.length}...`)
    const embedding = await embedText(chunk.text)
    vectors.push({
      id: chunk.id,
      values: embedding,
      metadata: { ...chunk.metadata, text: chunk.text },
    })
    if (i < chunks.length - 1) await sleep(200)
  }
  await index.upsert(vectors)
  return vectors.length
}

export async function queryVectorStore(query: string, topK = 3, filter?: Record<string, string>) {
  const index = getIndex()
  const queryVector = await embedText(query)
  const pineconeFilter = filter 
    ? Object.fromEntries(Object.entries(filter).map(([k, v]) => [k, { $eq: v }]))
    : undefined
  const results = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter: pineconeFilter,
  })
  return results.matches?.map((m) => ({
    score: m.score,
    text: m.metadata?.text as string,
    metadata: m.metadata,
  })) || []
}

export async function saveConversation(question: string, answer: string, role: string) {
  const index = getIndex()
  const id = `conv-${role}-${Date.now()}`
  const text = `用户问：${question}\nAI答：${answer}`
  const embedding = await embedText(text)
  await index.upsert([{
    id,
    values: embedding,
    metadata: { type: 'conversation', role, question, answer, text, timestamp: Date.now() }
  }])
}

export async function queryConversationHistory(query: string, role: string, topK = 3) {
  const index = getIndex()
  const queryVector = await embedText(query)
  const results = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter: { type: { $eq: 'conversation' }, role: { $eq: role } },
  })
  return results.matches?.map((m) => ({
    score: m.score,
    question: m.metadata?.question as string,
    answer: m.metadata?.answer as string,
  })) || []
}
