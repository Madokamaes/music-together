import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowDown, MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ChatMessage } from './ChatMessage'
import { useChatStore } from '@/stores/chatStore'
import { useRoomStore } from '@/stores/roomStore'
import { useChat } from '@/hooks/useChat'

/** Threshold (px) to consider the user "at the bottom" of the scroll container */
const SCROLL_BOTTOM_THRESHOLD = 80

export function ChatPanel() {
  const [input, setInput] = useState('')
  const [showNewMsgHint, setShowNewMsgHint] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const messages = useChatStore((s) => s.messages)
  const currentUser = useRoomStore((s) => s.currentUser)
  const { sendMessage } = useChat()

  // Track whether the user has scrolled to the bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD
    isAtBottomRef.current = atBottom
    if (atBottom) setShowNewMsgHint(false)
  }, [])

  // Smart auto-scroll: only scroll to bottom if user was already at the bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else {
      // User has scrolled up — show new message hint
      setShowNewMsgHint(true)
    }
  }, [messages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowNewMsgHint(false)
  }, [])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[22px] border border-border bg-background/55 backdrop-blur-[18px]">
      {/* Header */}
      <div className="flex min-h-[52px] shrink-0 items-center gap-2 border-b border-border px-3.5 py-0">
        <span className="grid h-7 w-7 place-items-center rounded-[10px] border border-primary/15 bg-primary/[0.07] text-[#f3d79e]">
          <MessageSquare className="h-[15px] w-[15px]" />
        </span>
        <span className="text-sm font-bold text-foreground">聊天</span>
      </div>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto px-3"
          aria-live="polite"
          aria-label="聊天消息"
        >
          <div className="py-3">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground/40">还没有消息，开始聊天吧~</p>
            ) : (
              messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} isOwnMessage={msg.userId === currentUser?.id} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* New message hint */}
        {showNewMsgHint && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 gap-1 rounded-full shadow-md"
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            新消息
          </Button>
        )}
      </div>

      {/* Input */}
      <div className="flex shrink-0 gap-2 border-t border-border p-3">
        <Input
          placeholder="输入消息..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1"
          aria-label="输入聊天消息"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="secondary" onClick={handleSend} disabled={!input.trim()} aria-label="发送消息">
              <Send className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>发送</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
