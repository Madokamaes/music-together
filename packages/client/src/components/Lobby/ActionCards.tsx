import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Home, LogIn } from 'lucide-react'
import { motion } from 'motion/react'

interface ActionCardsProps {
  directRoomId: string
  onDirectRoomIdChange: (value: string) => void
  onCreateClick: () => void
  onDirectJoin: () => void
  actionLoading: boolean
}

export function ActionCards({
  directRoomId,
  onDirectRoomIdChange,
  onCreateClick,
  onDirectJoin,
  actionLoading,
}: ActionCardsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="mb-10 grid gap-4 sm:grid-cols-2"
    >
      {/* Create room card */}
      <div className="mt-card flex min-h-[188px] flex-col justify-between rounded-[22px] p-5">
        <div className="mb-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="mt-icon-box h-[42px] w-[42px]">
              <Home className="h-5 w-5" />
            </div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">创建房间</h2>
          </div>
          <p className="text-[13px] leading-[1.7] text-muted-foreground">新建一个房间，分享房间号邀请朋友加入</p>
        </div>
        <Button onClick={onCreateClick} className="w-full">
          <Home className="mr-1 h-4 w-4" />
          创建房间
        </Button>
      </div>

      {/* Join room card */}
      <div className="mt-card flex min-h-[188px] flex-col justify-between rounded-[22px] p-5">
        <div className="mb-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="mt-icon-box h-[42px] w-[42px]">
              <LogIn className="h-5 w-5" />
            </div>
            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">加入房间</h2>
          </div>
          <p className="text-[13px] leading-[1.7] text-muted-foreground">输入房间号直接加入已有房间</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="输入房间号..."
            value={directRoomId}
            onChange={(e) => onDirectRoomIdChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onDirectJoin()}
            className="min-w-0 flex-1"
          />
          <Button variant="secondary" onClick={onDirectJoin} disabled={actionLoading} className="px-5">
            加入
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
