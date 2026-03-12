import { useState, useRef, useEffect, useMemo } from "react"
import { Send, Loader2, Sparkles, BarChart3, Trash2, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Message = { role: "user" | "assistant"; content: string }

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-data`

const SUGGESTED_QUESTIONS = [
  "What's the current state of Nigeria's economy?",
  "How does Nigeria's life expectancy compare to its peers?",
  "What are Nigeria's biggest infrastructure challenges?",
  "Analyze Nigeria's unemployment trends and implications",
  "How is Nigeria performing on education metrics?",
  "What does Nigeria's population growth mean for policy?",
]

async function streamChat({
  messages,
  onDelta,
  onDone,
  signal,
}: {
  messages: Message[]
  onDelta: (text: string) => void
  onDone: () => void
  signal?: AbortSignal
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
    signal,
  })
  if (!resp.ok || !resp.body) {
    const err = await resp.text()
    throw new Error(err || "Failed to start stream")
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let textBuffer = ""
  let streamDone = false

  while (!streamDone) {
    const { done, value } = await reader.read()
    if (done) break
    textBuffer += decoder.decode(value, { stream: true })

    let newlineIndex: number
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex)
      textBuffer = textBuffer.slice(newlineIndex + 1)

      if (line.endsWith("\r")) line = line.slice(0, -1)
      if (line.startsWith(":") || line.trim() === "") continue
      if (!line.startsWith("data: ")) continue

      const jsonStr = line.slice(6).trim()
      if (jsonStr === "[DONE]") {
        streamDone = true
        break
      }

      try {
        const parsed = JSON.parse(jsonStr)
        const content = parsed.choices?.[0]?.delta?.content as string | undefined
        if (content) onDelta(content)
      } catch {
        textBuffer = line + "\n" + textBuffer
        break
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue
      if (raw.endsWith("\r")) raw = raw.slice(0, -1)
      if (raw.startsWith(":") || raw.trim() === "") continue
      if (!raw.startsWith("data: ")) continue
      const jsonStr = raw.slice(6).trim()
      if (jsonStr === "[DONE]") continue
      try {
        const parsed = JSON.parse(jsonStr)
        const content = parsed.choices?.[0]?.delta?.content as string | undefined
        if (content) onDelta(content)
      } catch { /* ignore */ }
    }
  }

  onDone()
}

// ── Rich content parsing ──
// Detect stat patterns like "**GDP Per Capita**: $2,184 (2022)" or "Population: 218.5 million"
type ParsedBlock =
  | { type: "stat-card"; label: string; value: string; date?: string; trend?: "up" | "down" | "neutral"; source?: string }
  | { type: "markdown"; content: string }

const SOURCE_URLS: Record<string, string> = {
  "World Bank": "https://datacatalog.worldbank.org",
  "United Nations": "https://population.un.org/dataportal",
  "WHO": "https://www.who.int/data/gho",
  "UNESCO": "https://data.uis.unesco.org",
  "FAO": "https://www.fao.org/faostat",
  "ITU": "https://datahub.itu.int",
}

function detectTrend(text: string): "up" | "down" | "neutral" | undefined {
  const lower = text.toLowerCase()
  if (/increas|grow|ris|improv|gain|surge|expand|climb/.test(lower)) return "up"
  if (/declin|drop|fall|shrink|decreas|worsen|contract|reduc/.test(lower)) return "down"
  if (/stable|flat|stagnant|unchanged/.test(lower)) return "neutral"
  return undefined
}

function parseAssistantContent(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  const lines = content.split("\n")
  let markdownBuffer: string[] = []

  const flushMarkdown = () => {
    if (markdownBuffer.length > 0) {
      blocks.push({ type: "markdown", content: markdownBuffer.join("\n") })
      markdownBuffer = []
    }
  }

  // Pattern: **Label**: Value (Year) [source: X]
  const statPattern = /^[-*•]?\s*\*\*([^*]+)\*\*\s*[:：]\s*(.+)$/
  const tableStatPattern = /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|?\s*$/

  let pendingStats: ParsedBlock[] = []

  for (const line of lines) {
    const statMatch = line.trim().match(statPattern)
    const tableMatch = !statMatch && line.trim().match(tableStatPattern)

    if (statMatch) {
      const label = statMatch[1].trim()
      let rawValue = statMatch[2].trim()
      
      // Extract source from [source: X]
      const sourceMatch = rawValue.match(/\[source:\s*([^\]]+)\]/)
      const source = sourceMatch?.[1]?.trim()
      if (sourceMatch) rawValue = rawValue.replace(sourceMatch[0], "").trim()
      
      // Extract date from parenthetical
      const dateMatch = rawValue.match(/\((?:as of\s*)?(\d{4})\)/)
      const value = rawValue.replace(/\((?:as of\s*)?\d{4}\)/, "").trim()
      
      if (/[\d$%₦]/.test(value) && label.length < 60) {
        flushMarkdown()
        pendingStats.push({
          type: "stat-card",
          label,
          value,
          date: dateMatch?.[1],
          trend: detectTrend(rawValue),
          source,
        })
        continue
      }
    }

    if (tableMatch) {
      const label = tableMatch[1].trim()
      const value = tableMatch[2].trim()
      if (/[\d$%₦]/.test(value) && !label.startsWith("---") && label.length < 60) {
        flushMarkdown()
        pendingStats.push({
          type: "stat-card",
          label,
          value,
          trend: detectTrend(value),
        })
        continue
      }
    }

    if (pendingStats.length > 0) {
      blocks.push(...pendingStats)
      pendingStats = []
    }

    markdownBuffer.push(line)
  }

  if (pendingStats.length > 0) {
    blocks.push(...pendingStats)
  }
  flushMarkdown()

  return blocks
}

function StatCard({ label, value, date, trend, source }: { label: string; value: string; date?: string; trend?: "up" | "down" | "neutral"; source?: string }) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus
  const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-muted-foreground"
  const sourceUrl = source ? SOURCE_URLS[source] || `https://datacommons.org/place/country/NGA` : undefined

  return (
    <Card className="border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
            <p className="text-lg font-bold text-foreground mt-1 leading-tight">{value}</p>
            {date && <p className="text-[10px] text-muted-foreground mt-0.5">As of {date}</p>}
          </div>
          {trend && (
            <div className={`shrink-0 p-1.5 rounded-md bg-muted/50 ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
        {/* Source reference — Data Commons style */}
        <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>Source:</span>
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
              {source} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ) : (
            <span>{source || "Data Commons"}</span>
          )}
          <span>•</span>
          <a href="https://datacommons.org/place/country/NGA" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
            About this data <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

function RichAssistantMessage({ content }: { content: string }) {
  const blocks = useMemo(() => parseAssistantContent(content), [content])

  // Group consecutive stat cards
  const rendered: React.ReactNode[] = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]
    if (block.type === "stat-card") {
      const statGroup: (typeof blocks[number] & { type: "stat-card" })[] = []
      while (i < blocks.length && blocks[i].type === "stat-card") {
        statGroup.push(blocks[i] as any)
        i++
      }
      rendered.push(
        <div key={`stats-${i}`} className="grid grid-cols-2 lg:grid-cols-3 gap-3 my-4">
          {statGroup.map((s, j) => (
            <motion.div
              key={j}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: j * 0.05 }}
            >
              <StatCard label={s.label} value={s.value} date={s.date} trend={s.trend} />
            </motion.div>
          ))}
        </div>
      )
    } else {
      rendered.push(
        <div key={`md-${i}`} className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-li:text-foreground">
          <ReactMarkdown>{block.content}</ReactMarkdown>
        </div>
      )
      i++
    }
  }

  return <>{rendered}</>
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return
    const userMsg: Message = { role: "user", content: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    let assistantSoFar = ""
    const controller = new AbortController()
    abortRef.current = controller

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m))
        }
        return [...prev, { role: "assistant", content: assistantSoFar }]
      })
    }

    try {
      await streamChat({
        messages: [...messages, userMsg],
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false),
        signal: controller.signal,
      })
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error(e)
        upsertAssistant("\n\n*An error occurred. Please try again.*")
      }
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const clearChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setIsLoading(false)
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Navbar */}
      <header className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 flex items-center h-14 gap-3 md:gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-foreground whitespace-nowrap">
              <span className="text-sm md:hidden">NDIP</span>
              <span className="hidden md:inline text-lg">Nigeria Data Intelligence Platform</span>
            </span>
          </Link>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">NDIP Intelligence</span>
              <span className="sm:hidden">AI</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              <BarChart3 className="w-3 h-3" />
              <span>Live Data</span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Ask NDIP Intelligence</h2>
                <p className="text-muted-foreground max-w-md">
                  Get data-driven insights on Nigeria's economy, health, education, demographics, and more — powered by live official data.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => send(q)}
                    className="text-left px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all text-sm text-foreground group"
                  >
                    <span className="text-primary mr-1.5 opacity-60 group-hover:opacity-100">→</span>
                    {q}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "user" ? (
                      <div className="max-w-[80%] bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-br-md text-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="max-w-[95%] w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">NDIP Intelligence</span>
                        </div>
                        <RichAssistantMessage content={msg.content} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 text-primary animate-spin" />
                  </div>
                  <span className="text-xs">Analyzing live data...</span>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-end gap-3 bg-muted/50 border border-border rounded-2xl px-4 py-3 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about Nigeria's economy, health, demographics..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-32"
              style={{ minHeight: "24px" }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = "24px"
                el.style.height = Math.min(el.scrollHeight, 128) + "px"
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || isLoading}
              className="shrink-0 w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Powered by live data from World Bank, UN & WHO · © {new Date().getFullYear()} Lantid Creative LTD
          </p>
        </div>
      </div>
    </div>
  )
}
