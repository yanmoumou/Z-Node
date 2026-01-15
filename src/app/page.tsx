'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ROLES, RoleKey } from '@/lib/prompts'

interface ChatItem {
  question: string
  answer: string
  conflict?: { hasConflict: boolean; conflictDetails?: string; suggestion?: string }
  image?: string
  imageLoading?: boolean
}

const CornerBrackets = () => (
  <>
    <div className="corner-bracket cb-tl" />
    <div className="corner-bracket cb-tr" />
    <div className="corner-bracket cb-bl" />
    <div className="corner-bracket cb-br" />
  </>
)

const stagger = {
  animate: { transition: { staggerChildren: 0.15 } }
}

export default function Home() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tip, setTip] = useState('')
  const [history, setHistory] = useState<ChatItem[]>([])
  const [streaming, setStreaming] = useState('')
  const [mounted, setMounted] = useState(false)
  const [role, setRole] = useState<RoleKey>('general')
  const [showRoleChange, setShowRoleChange] = useState(false)
  const lastClick = useRef(0)
  const historyRef = useRef<ChatItem[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('chat_history')
    if (saved) {
      const parsed = JSON.parse(saved) as ChatItem[]
      historyRef.current = parsed
      requestAnimationFrame(() => setHistory(parsed))
    }
    requestAnimationFrame(() => setMounted(true))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, streaming])

  const saveHistory = (newHistory: ChatItem[]) => {
    setHistory(newHistory)
    historyRef.current = newHistory
    localStorage.setItem('chat_history', JSON.stringify(newHistory))
  }

  const handleSubmit = async () => {
    if (loading) {
      setTip('[ 终端占用中 ]')
      setTimeout(() => setTip(''), 2000)
      return
    }
    const now = Date.now()
    if (now - lastClick.current < 1000) {
      setTip('[ 信号同步频率过快 ]')
      setTimeout(() => setTip(''), 2000)
      return
    }
    lastClick.current = now
    if (!input.trim()) return
    setLoading(true)
    setTip('')
    setStreaming('')
    const question = input
    setInput('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, role, history: historyRef.current }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const json = JSON.parse(line.slice(5))
              const text = json.output?.text || ''
              fullText += text
              setStreaming(fullText)
            } catch {}
          }
        }
      }

      const finalAnswer = fullText || '[ 信号丢失 ]'
      const newItem: ChatItem = { question, answer: finalAnswer }
      
      if (finalAnswer !== '[ 信号丢失 ]' && role !== 'general' && role !== 'archive') {
        fetch('/api/check-conflict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: finalAnswer, role }),
        })
          .then(res => res.json())
          .then(result => {
            if (result.hasConflict) {
              const updatedHistory = [...historyRef.current]
              const lastIdx = updatedHistory.length - 1
              if (lastIdx >= 0) {
                updatedHistory[lastIdx] = { ...updatedHistory[lastIdx], conflict: result }
                saveHistory(updatedHistory)
              }
            }
          })
          .catch(() => {})
        
        fetch('/api/chat/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, answer: finalAnswer, role }),
        }).catch(() => {})
      }
      
      saveHistory([...historyRef.current, newItem])
      setStreaming('')
    } catch {
      saveHistory([...historyRef.current, { question, answer: '[ 链路中断 ]' }])
    }
    setLoading(false)
  }

  const clearHistory = () => {
    setHistory([])
    historyRef.current = []
    localStorage.removeItem('chat_history')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const generateImage = async (index: number) => {
    const item = historyRef.current[index]
    if (!item || item.imageLoading) return
    
    const updated = [...historyRef.current]
    updated[index] = { ...updated[index], imageLoading: true }
    saveHistory(updated)
    
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: item.answer.slice(0, 200), role })
      })
      const data = await res.json()
      
      const final = [...historyRef.current]
      final[index] = { ...final[index], image: data.url, imageLoading: false }
      saveHistory(final)
    } catch {
      const final = [...historyRef.current]
      final[index] = { ...final[index], imageLoading: false }
      saveHistory(final)
    }
  }

  const handleRoleChange = (newRole: RoleKey) => {
    if (newRole !== role) {
      setShowRoleChange(true)
      setTimeout(() => {
        setRole(newRole)
        setShowRoleChange(false)
      }, 300)
    }
  }

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#020b16] flex items-center justify-center">
        <motion.div 
          className="text-6xl text-cyan-400"
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ◈
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen sheikah-map-grid p-4 md:p-8 relative overflow-hidden">
      <div className="scanline" />
      
      {/* 角色切换闪光效果 */}
      <AnimatePresence>
        {showRoleChange && (
          <motion.div
            className="fixed inset-0 bg-cyan-500 z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>
      
      <motion.div 
        className="max-w-5xl mx-auto space-y-6 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* 顶部：地图状态栏 */}
        <motion.header 
          className="flex items-center justify-between px-2 py-4"
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, type: "spring", bounce: 0.4 }}
        >
          <div className="flex items-center gap-6">
            <motion.div 
              className="relative"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="text-4xl text-cyan-400 animate-flicker drop-shadow-[0_0_8px_rgba(0,243,255,0.6)]">◈</div>
            </motion.div>
            <div>
              <h1 className="sheikah-title-text text-3xl italic uppercase tracking-wider">
                Map
              </h1>
              <div className="flex items-center gap-3 text-[10px] text-cyan-500/60 font-bold mt-1">
                <span className="border border-cyan-500/30 px-1">L</span>
                <span className="tracking-[0.2em]">SHEIKAH_SLATE_v1.0.8</span>
                <span className="border border-cyan-500/30 px-1">R</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-xs text-cyan-400 font-black">+62 °F</div>
              <div className="text-[9px] opacity-40">LANAYRU_PROVINCE</div>
            </div>
            <AnimatePresence>
              {history.length > 0 && (
                <motion.button 
                  onClick={clearHistory} 
                  className="bg-red-500/10 border border-red-500/40 px-4 py-1 text-[10px] text-red-400 font-bold hover:bg-red-500/20"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  [ 清除标点 ]
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧：节点列表 */}
          <motion.aside 
            className="lg:col-span-1 space-y-4"
            initial={{ opacity: 0, x: -100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4, type: "spring", bounce: 0.3 }}
          >
            <div className="sheikah-container p-4">
              <CornerBrackets />
              <div className="text-[10px] text-cyan-400/70 mb-4 font-black uppercase tracking-widest">节点链路</div>
              <motion.div className="flex flex-col gap-2" variants={stagger} initial="initial" animate="animate">
                {(Object.keys(ROLES) as RoleKey[]).map((key, i) => (
                  <motion.button
                    key={key}
                    onClick={() => handleRoleChange(key)}
                    className={`px-3 py-2 text-left rounded-none transition-colors ${
                      role === key ? 'sheikah-map-btn-active' : 'sheikah-map-btn'
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(0,243,255,0.1)' }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15, delay: i * 0.03 }}
                  >
                    {ROLES[key].name}
                  </motion.button>
                ))}
              </motion.div>
            </div>
          </motion.aside>

          {/* 右侧：主交互区 */}
          <motion.div 
            className="lg:col-span-3 space-y-6"
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5, type: "spring", bounce: 0.3 }}
          >
            <div className="sheikah-container min-h-[500px] flex flex-col">
              <CornerBrackets />
              <div className="p-3 border-b border-cyan-500/20 flex justify-between items-center px-8 bg-cyan-950/20">
                <span className="text-[10px] text-cyan-400 font-bold tracking-[0.2em] uppercase italic">Follow the Sheikah Slate</span>
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <motion.div 
                      key={i} 
                      className="w-1 h-1 bg-cyan-400/40"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto space-y-10 scrollbar-hide max-h-[55vh]">
                <AnimatePresence mode="wait">
                  {history.length === 0 && !streaming && (
                    <motion.div 
                      className="h-full flex flex-col items-center justify-center opacity-20 py-20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.2 }}
                      exit={{ opacity: 0 }}
                    >
                      <motion.div 
                        className="text-5xl mb-4 text-cyan-400"
                        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        ◈
                      </motion.div>
                      <div className="text-[11px] tracking-[0.4em] font-black uppercase">等待信号输入...</div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {history.map((item, i) => (
                  <motion.div 
                    key={i} 
                    className="space-y-6"
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, type: "spring", bounce: 0.3 }}
                  >
                    <motion.div 
                      className="map-info-box map-info-box-user ml-12"
                      initial={{ opacity: 0, x: 80, rotate: 2 }}
                      animate={{ opacity: 1, x: 0, rotate: 0 }}
                      transition={{ duration: 0.4, type: "spring" }}
                    >
                      <span className="label-tag bg-orange-500 text-black">USER_INPUT</span>
                      <div className="text-sm leading-relaxed text-orange-100/90">{item.question}</div>
                    </motion.div>
                    <motion.div 
                      className="map-info-box map-info-box-ai mr-12"
                      initial={{ opacity: 0, x: -80, rotate: -2 }}
                      animate={{ opacity: 1, x: 0, rotate: 0 }}
                      transition={{ duration: 0.4, delay: 0.15, type: "spring" }}
                    >
                      <span className="label-tag bg-cyan-500 text-black">{role.toUpperCase()}_LOG</span>
                      <div className="text-sm leading-relaxed text-cyan-100/90 whitespace-pre-wrap">{item.answer}</div>
                    </motion.div>
                    
                    {/* 冲突警告 */}
                    <AnimatePresence>
                      {item.conflict?.hasConflict && (
                        <motion.div
                          className="mr-12 mt-2 p-3 bg-red-500/10 border border-red-500/40 text-xs"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
                            <span>⚠</span>
                            <span>设定冲突检测</span>
                          </div>
                          <div className="text-red-300/80 mb-1">
                            <span className="text-red-400">冲突：</span>{item.conflict.conflictDetails}
                          </div>
                          <div className="text-yellow-300/80">
                            <span className="text-yellow-400">建议：</span>{item.conflict.suggestion}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* 插画生成 */}
                    <div className="mr-12 mt-3 flex items-center gap-4">
                      {!item.image && !item.imageLoading && role !== 'general' && role !== 'archive' && (
                        <motion.button
                          onClick={() => generateImage(i)}
                          className="text-[10px] text-cyan-400/60 border border-cyan-500/30 px-3 py-1 hover:bg-cyan-500/10"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          ✦ 生成记忆插画
                        </motion.button>
                      )}
                      {item.imageLoading && (
                        <div className="text-[10px] text-cyan-400/60 animate-pulse">◈ 记忆绘制中...</div>
                      )}
                    </div>
                    
                    {item.image && (
                      <motion.div
                        className="mr-12 mt-4"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <div className="text-[9px] text-cyan-400/50 mb-2">[ 记忆回溯 - 视觉重构 ]</div>
                        <img 
                          src={item.image} 
                          alt="记忆插画" 
                          className="max-w-md border border-cyan-500/30 shadow-[0_0_20px_rgba(0,243,255,0.2)]"
                        />
                      </motion.div>
                    )}
                  </motion.div>
                ))}

                <AnimatePresence>
                  {streaming && (
                    <motion.div 
                      className="map-info-box map-info-box-ai mr-12"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <span className="label-tag bg-cyan-500 text-black italic animate-pulse">TRANSMITTING...</span>
                      <div className="text-sm leading-relaxed text-cyan-100/90 whitespace-pre-wrap">
                        {streaming}
                        <motion.span 
                          className="inline-block w-2 h-4 bg-cyan-400 ml-1"
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={chatEndRef} />
              </div>

              {/* 输入框 */}
              <div className="p-6 border-t border-cyan-500/20 bg-cyan-950/20">
                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入指令以同步信号..."
                    className="w-full bg-black/40 border border-cyan-500/30 p-4 text-sm text-cyan-100 outline-none focus:border-cyan-400 min-h-[100px] resize-none transition-all duration-300"
                    disabled={loading}
                  />
                  <div className="absolute bottom-4 right-4 flex items-center gap-4">
                    <AnimatePresence>
                      {tip && (
                        <motion.span 
                          className="text-orange-500 text-[10px] font-bold"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                        >
                          {tip}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <motion.button
                      onClick={handleSubmit}
                      disabled={loading || !input.trim()}
                      className={`px-8 py-2 text-xs font-black tracking-widest transition-all ${
                        loading || !input.trim()
                        ? 'opacity-20 grayscale border border-cyan-900'
                        : 'bg-cyan-500 text-black border border-cyan-400'
                      }`}
                      whileHover={!loading && input.trim() ? { scale: 1.05, boxShadow: '0 0 20px rgba(0,243,255,0.5)' } : {}}
                      whileTap={!loading && input.trim() ? { scale: 0.95 } : {}}
                    >
                      {loading ? 'SYNCING' : 'SELECT'}
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.footer 
          className="flex justify-between items-center py-4 border-t border-cyan-500/10 text-[9px] opacity-30 font-bold uppercase tracking-[0.5em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <div>Move L</div>
          <div>Back B</div>
          <div>Select A</div>
          <div>Zoom R</div>
        </motion.footer>
      </motion.div>
    </main>
  )
}
