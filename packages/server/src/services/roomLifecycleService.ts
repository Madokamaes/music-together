/**
 * Room Lifecycle Service
 *
 * Manages destroyed-room cleanup and debounced lobby broadcasts.
 * Extracted from roomService to separate lifecycle/timer concerns from CRUD logic
 * and eliminate the circular dependency (roomService -> playerController -> roomService).
 *
 * Dependency direction:
 *   roomService -> roomLifecycleService -> (repos, playerService, voteService, authService)
 *   roomLifecycleService does NOT depend on roomService (no circular risk).
 *
 * Note: Role grace period has been removed. Owner role is permanent (based on creatorId),
 * admin is persisted via adminUserIds, and conductor (hostId) is auto-elected by
 * electConductor() in roomService whenever users join/leave.
 */

import type { RoomListItem } from '@music-together/shared'
import { EVENTS } from '@music-together/shared'
import type { TypedServer } from '../middleware/types.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { logger } from '../utils/logger.js'
import { cleanupRoom as cleanupAuthRoom } from './authService.js'
import { cleanupRoom as cleanupPlayerRoom } from './playerService.js'
import { cleanupRoom as cleanupVoteRoom } from './voteService.js'
import { cleanupRoomRejoinTickets } from './rejoinTicketService.js'

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** Legacy deletion timers are only cleared for safety after upgrades from older code paths. */
const roomDeletionTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** 防抖广播：100ms trailing debounce */
let broadcastTimer: ReturnType<typeof setTimeout> | null = null
let pendingIO: TypedServer | null = null

// ---------------------------------------------------------------------------
// Room deletion timer
// ---------------------------------------------------------------------------

export function cancelDeletionTimer(roomId: string): void {
  const timer = roomDeletionTimers.get(roomId)
  if (timer) {
    clearTimeout(timer)
    roomDeletionTimers.delete(roomId)
    logger.info(`Room ${roomId} deletion cancelled — user rejoined`, { roomId })
  }
}

export function cleanupDestroyedRoom(roomId: string): void {
  cancelDeletionTimer(roomId)
  cleanupPlayerRoom(roomId)
  cleanupVoteRoom(roomId)
  cleanupAuthRoom(roomId)
  cleanupRoomRejoinTickets(roomId)
}

// ---------------------------------------------------------------------------
// Debounced lobby broadcast
// ---------------------------------------------------------------------------

/**
 * 向 lobby 频道广播房间列表变更（100ms trailing 防抖）。
 * 多次快速调用（如 create+join、多人同时 leave）会合并为一次广播，
 * 避免重复执行 getAllAsList() 遍历和序列化。
 */
export function broadcastRoomList(io: TypedServer): void {
  pendingIO = io
  if (broadcastTimer) return
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null
    if (pendingIO) {
      const rooms: RoomListItem[] = roomRepo.getAllAsList()
      pendingIO.to('lobby').emit(EVENTS.ROOM_LIST_UPDATE, rooms)
    }
  }, 100)
}

// ---------------------------------------------------------------------------
// Shutdown cleanup — clear all module-level timers
// ---------------------------------------------------------------------------

/** Clear all timers managed by this module. Call during graceful shutdown. */
export function clearAllTimers(): void {
  // Room deletion timers
  for (const timer of roomDeletionTimers.values()) clearTimeout(timer)
  roomDeletionTimers.clear()

  // Broadcast debounce timer
  if (broadcastTimer) {
    clearTimeout(broadcastTimer)
    broadcastTimer = null
  }
  pendingIO = null

  logger.info('All roomLifecycleService timers cleared')
}
