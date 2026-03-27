'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Trash2,
  ChevronDown,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  isError?: boolean
}

interface AIAssistantProps {
  className?: string
  onProductSelect?: (productId: string) => void
}

export function AIAssistant({ className, onProductSelect }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Halo! 👋 Saya **Kasir AI**, siap membantu kamu.

Beberapa hal yang bisa saya bantu:
• Cari produk ("cari kopi dingin")
• Cek stok ("stok apa yang menipis?")
• Hitung diskon ("hitung diskon 15% dari 100rb")
• Laporan penjualan ("penjualan hari ini gimana?")

Silakan tanya apa saja! 😊`,
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [showScrollButton, setShowScrollButton] = useState(false)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  // Handle scroll position untuk show/hide scroll button
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }, [])

  // Generate unique ID
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  // Submit handler
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading) return

    // Clear input immediately
    setInput('')

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setStreamingContent('')

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Process streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          const remaining = buffer.trim()
          if (remaining.startsWith('data: ')) {
            const data = remaining.slice(6)
            if (data) {
              try {
                const parsed = JSON.parse(data)
                if (parsed.type === 'content') {
                  fullContent += parsed.content
                  setStreamingContent(fullContent)
                } else if (parsed.type === 'done') {
                  setMessages(prev => [...prev, {
                    id: generateId(),
                    role: 'assistant',
                    content: fullContent,
                    timestamp: new Date()
                  }])
                  setStreamingContent('')
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error)
                }
              } catch (parseError) {
                // Ignore incomplete/invalid trailing event
              }
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const lines = event
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .filter(line => line.startsWith('data: '))

          if (lines.length === 0) continue
          const data = lines.map(line => line.slice(6)).join('\n')
          if (!data) continue

          try {
            const parsed = JSON.parse(data)

            if (parsed.type === 'content') {
              fullContent += parsed.content
              setStreamingContent(fullContent)
            } else if (parsed.type === 'done') {
              // Streaming complete - add as final message
              setMessages(prev => [...prev, {
                id: generateId(),
                role: 'assistant',
                content: fullContent,
                timestamp: new Date()
              }])
              setStreamingContent('')
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error)
            }
          } catch (parseError) {
            // Skip invalid JSON
          }
        }
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled
        console.log('Request cancelled')
      } else {
        console.error('Chat error:', error)

        // Add error message
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
          timestamp: new Date(),
          isError: true
        }])
      }
      setStreamingContent('')
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
      inputRef.current?.focus()
    }
  }

  // Cancel ongoing request
  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  // Clear chat history
  const clearChat = () => {
    setMessages([messages[0]]) // Keep welcome message
    setStreamingContent('')
  }

  // Quick action buttons
  const quickActions = [
    { label: '📦 Stok menipis', query: 'Stok apa yang menipis?' },
    { label: '💰 Penjualan hari ini', query: 'Bagaimana penjualan hari ini?' },
    { label: '🏆 Produk terlaris', query: 'Produk apa yang paling laris minggu ini?' },
    { label: '💳 Metode bayar', query: 'Breakdown pembayaran hari ini' },
  ]

  return (
    <div className={cn(
      'flex flex-col h-full border rounded-lg bg-background overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Kasir AI</h3>
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Sedang mengetik...' : 'Online'}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={clearChat}
          title="Hapus percakapan"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea
        ref={scrollAreaRef}
        className="flex-1 p-4"
        onScrollCapture={handleScroll as any}
      >
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                  message.isError ? 'bg-destructive/10' : 'bg-primary/10'
                )}>
                  {message.isError ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                </div>
              )}

              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : message.isError
                      ? 'bg-destructive/10 text-destructive rounded-bl-md'
                      : 'bg-muted rounded-bl-md'
                )}
              >
                <div className="text-sm leading-relaxed">
                  <ReactMarkdown
                    components={{
                      p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                      ul: ({ ...props }) => <ul className="mb-2 list-disc pl-5 last:mb-0" {...props} />,
                      ol: ({ ...props }) => <ol className="mb-2 list-decimal pl-5 last:mb-0" {...props} />,
                      li: ({ ...props }) => <li className="mb-1 last:mb-0" {...props} />,
                      h1: ({ ...props }) => <h1 className="mb-2 text-base font-semibold" {...props} />,
                      h2: ({ ...props }) => <h2 className="mb-2 text-sm font-semibold" {...props} />,
                      h3: ({ ...props }) => <h3 className="mb-2 text-sm font-semibold" {...props} />,
                      strong: ({ ...props }) => <strong className="font-semibold" {...props} />
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                <span className="text-[10px] opacity-60 mt-1 block">
                  {message.timestamp.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {message.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming content */}
          {streamingContent && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 bg-muted">
                <div className="text-sm leading-relaxed">
                  <ReactMarkdown
                    components={{
                      p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                      ul: ({ ...props }) => <ul className="mb-2 list-disc pl-5 last:mb-0" {...props} />,
                      ol: ({ ...props }) => <ol className="mb-2 list-decimal pl-5 last:mb-0" {...props} />,
                      li: ({ ...props }) => <li className="mb-1 last:mb-0" {...props} />,
                      h1: ({ ...props }) => <h1 className="mb-2 text-base font-semibold" {...props} />,
                      h2: ({ ...props }) => <h2 className="mb-2 text-sm font-semibold" {...props} />,
                      h3: ({ ...props }) => <h3 className="mb-2 text-sm font-semibold" {...props} />,
                      strong: ({ ...props }) => <strong className="font-semibold" {...props} />
                    }}
                  >
                    {streamingContent}
                  </ReactMarkdown>
                </div>
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 rounded-sm" />
              </div>
            </div>
          )}

          {/* Loading indicator (before streaming starts) */}
          {isLoading && !streamingContent && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full shadow-lg"
            onClick={scrollToBottom}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      {messages.length <= 2 && !isLoading && (
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground mb-2">Coba tanya:</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setInput(action.query)
                  setTimeout(() => handleSubmit(), 100)
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t bg-background">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ketik pertanyaan..."
            disabled={isLoading}
            className="flex-1"
            autoComplete="off"
          />
          {isLoading ? (
            <Button
              type="button"
              variant="destructive"
              onClick={cancelRequest}
            >
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
