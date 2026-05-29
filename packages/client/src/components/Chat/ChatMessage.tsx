import { memo } from 'react'
import dayjs from 'dayjs'
import { motion } from 'motion/react'
import type { ChatMessage as ChatMessageType } from '@music-together/shared'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  message: ChatMessageType
  isOwnMessage: boolean
}

export const ChatMessage = memo(function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  if (message.type === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="py-1.5 text-center text-xs text-muted-foreground/50"
      >
        {message.content}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn('flex flex-col gap-0.5 py-1.5', isOwnMessage ? 'items-end' : 'items-start')}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{message.nickname}</span>
        <span className="text-xs text-muted-foreground/40">{dayjs(message.timestamp).format('HH:mm')}</span>
      </div>
      <div
        className={cn(
          'max-w-[88%] rounded-2xl px-[11px] py-[9px] text-[13px] leading-[1.55] break-words',
          isOwnMessage
            ? 'border border-primary/20 bg-primary/[0.08] text-foreground'
            : 'border border-border bg-white/[0.045] text-muted-foreground',
        )}
      >
        {message.content}
      </div>
    </motion.div>
  )
})
