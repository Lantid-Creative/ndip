import { useState, useRef, useEffect } from "react"
import { Send, Loader2, ArrowLeft, Sparkles, BarChart3, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"

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

  // Final flush
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
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground">NDIP Intelligence</h1>
                <p className="text-xs text-muted-foreground">AI-powered Nigeria data analysis</p>
              </div>
            </div>
          </div>
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
                      <div className="max-w-[90%] w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">NDIP Intelligence</span>
                        </div>
                        <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
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