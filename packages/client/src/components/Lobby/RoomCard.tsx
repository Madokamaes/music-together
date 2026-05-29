import { memo } from 'react'
import { Lock, LockOpen, Music, Users } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { RoomListItem } from '@music-together/shared'
import { cn } from '@/lib/utils'

interface RoomCardProps {
  room: RoomListItem
  index: number
  onClick: () => void
}

export const RoomCard = memo(function RoomCard({ room, index, onClick }: RoomCardProps) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'group relative flex w-full flex-col gap-0 overflow-hidden rounded-[22px] p-4 text-left',
        'mt-card transition-all duration-300',
        'hover:border-primary/30 hover:shadow-[0_26px_90px_rgb(0_0_0/34%)]',
        room.currentTrackTitle && 'border-primary/30 bg-[radial-gradient(circle_at_10%_0%,rgb(227_183_108/16%),transparent_12rem),linear-gradient(180deg,rgb(255_255_255/7.8%),rgb(255_255_255/2.8%)),rgb(28_36_50/92%)]',
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      {/* Room name row */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold text-foreground">{room.name}</h3>
          {room.currentTrackTitle ? (
            <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Music className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">
                {room.currentTrackTitle}
                {room.currentTrackArtist && ` - ${room.currentTrackArtist}`}
              </span>
            </p>
          ) : (
            <p className="mt-2 truncate text-xs text-muted-foreground">正在等待播放</p>
          )}
        </div>

        {/* Right side: playing animation + lock icon */}
        <div className="ml-3 flex shrink-0 items-center gap-2">
          {/* Subtle playing animation for rooms with active tracks */}
          {room.currentTrackTitle && (
            <div className="flex items-end gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 rounded-full bg-primary/60"
                  animate={prefersReducedMotion ? { height: 8 } : { height: [4, 12, 6, 10, 4] }}
                  transition={
                    prefersReducedMotion
                      ? {}
                      : {
                          duration: 1.2,
                          repeat: Infinity,
                          delay: i * 0.15,
                          ease: 'easeInOut',
                        }
                  }
                />
              ))}
            </div>
          )}
          <span className="inline-flex text-muted-foreground/60">
            {room.hasPassword ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          </span>
        </div>
      </div>

      {/* Bottom info */}
      <div className="mt-[18px] flex items-center justify-between gap-3 text-[11px] text-muted-foreground/70">
        <span className="flex items-center gap-1 text-primary/90">
          <Users className="h-3 w-3" />
          {room.userCount}
        </span>
        <span className="font-mono text-muted-foreground/60">{room.id}</span>
      </div>
    </motion.button>
  )
})
