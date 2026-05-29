import { create } from 'zustand'
import { storage } from '@/lib/storage'
import type { RoomState, User } from '@music-together/shared'

/**
 * Derive the current user from the authoritative room.users list.
 * Role is purely permission-based (owner/admin/member) — no client-side override.
 */
function deriveCurrentUser(room: RoomState | null): User | null {
  if (!room) return null
  const myId = storage.getUserId()
  return room.users.find((u) => u.id === myId) ?? null
}

interface RoomStore {
  room: RoomState | null
  currentUser: User | null
  /** 房间密码明文（从 ROOM_SETTINGS 事件接收） */
  roomPassword: string | null

  setRoom: (room: RoomState | null) => void
  updateRoom: (partial: Partial<RoomState>) => void
  setRoomPassword: (password: string | null) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
  reset: () => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  currentUser: null,
  roomPassword: null,

  setRoom: (room) => set({ room, currentUser: deriveCurrentUser(room) }),

  updateRoom: (partial) =>
    set((state) => {
      if (!state.room) return {}
      const room = { ...state.room, ...partial }
      // Re-derive currentUser when users list changed (role may have been updated by server)
      if ('users' in partial) {
        return { room, currentUser: deriveCurrentUser(room) }
      }
      return { room }
    }),

  setRoomPassword: (password) => set({ roomPassword: password }),

  addUser: (user) =>
    set((state) => {
      if (!state.room) return {}
      const nextMembers = state.room.members.some((member) => member.id === user.id)
        ? state.room.members.map((member) =>
            member.id === user.id
              ? { ...member, nickname: user.nickname, role: user.role, avatarUrl: user.avatarUrl, isOnline: true }
              : member,
          )
        : [
            ...state.room.members,
            {
              id: user.id,
              nickname: user.nickname,
              role: user.role,
              avatarUrl: user.avatarUrl,
              isOnline: true,
              joinedAt: Date.now(),
              lastSeenAt: Date.now(),
            },
          ]
      const room = {
        ...state.room,
        users: state.room.users.some((u) => u.id === user.id)
          ? state.room.users.map((u) => (u.id === user.id ? user : u))
          : [...state.room.users, user],
        members: nextMembers,
        onlineCount: state.room.users.some((u) => u.id === user.id) ? state.room.onlineCount : state.room.onlineCount + 1,
        memberCount: nextMembers.length,
      }
      const myId = storage.getUserId()
      if (user.id === myId) {
        // The added user is us — derive our currentUser from the updated room
        return { room, currentUser: deriveCurrentUser(room) }
      }
      return { room }
    }),

  removeUser: (userId) =>
    set((state) => {
      if (!state.room) return {}
      const users = state.room.users.filter((u) => u.id !== userId)
      const room = {
        ...state.room,
        users,
        members: state.room.members.map((member) =>
          member.id === userId ? { ...member, isOnline: false, lastSeenAt: Date.now() } : member,
        ),
        onlineCount: users.length,
      }
      const myId = storage.getUserId()
      if (userId === myId) {
        // We were removed — clear currentUser
        return { room, currentUser: null }
      }
      return { room }
    }),

  reset: () => set({ room: null, currentUser: null, roomPassword: null }),
}))
