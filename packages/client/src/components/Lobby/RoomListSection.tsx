import { Music } from 'lucide-react'
import { motion } from 'motion/react'
import type { RoomListItem } from '@music-together/shared'
import { RoomCard } from './RoomCard'
import { Skeleton } from '@/components/ui/skeleton'

interface RoomListSectionProps {
  rooms: RoomListItem[]
  isLoading: boolean
  onRoomClick: (room: RoomListItem) => void
}

export function RoomListSection({ rooms, isLoading, onRoomClick }: RoomListSectionProps) {
  return (
    <>
      <div className="mb-3.5 flex items-end justify-between gap-4">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">
          活跃房间
          {!isLoading && rooms.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">({rooms.length})</span>
          )}
        </h2>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mt-card flex flex-col gap-3 rounded-[22px] p-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-[rgb(240_223_195/20%)] bg-white/[0.035] px-6 py-[42px] text-center text-muted-foreground"
        >
          <div className="mt-icon-box h-14 w-14 text-2xl">
            <Music className="h-7 w-7" />
          </div>
          <div>
            <p className="text-base font-medium text-foreground/80">还没有活跃的房间</p>
            <p className="mt-1 text-sm text-muted-foreground">创建一个房间，邀请朋友一起听歌</p>
          </div>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room, i) => (
            <RoomCard key={room.id} room={room} index={i} onClick={() => onRoomClick(room)} />
          ))}
        </div>
      )}
    </>
  )
}
