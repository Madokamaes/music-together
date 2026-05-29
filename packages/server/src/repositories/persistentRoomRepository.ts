import type { AudioQuality, PlayMode, PlayState, RoomMember, Track, User, UserRole } from '@music-together/shared'
import { LIMITS } from '@music-together/shared'
import type { RoomData } from './types.js'
import { getDatabase } from '../persistence/database.js'

interface RoomRow {
  id: string
  name: string
  password: string | null
  creator_id: string
  host_id: string | null
  audio_quality: number
  play_mode: string
  queue_json: string
  current_track_json: string | null
  play_state_json: string
  is_hidden: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

interface MemberRow {
  room_id: string
  user_id: string
  role: UserRole
  joined_at: number
  last_seen_at: number | null
  is_online: number
  nickname: string
  avatar_kind: string
  avatar_value: string | null
  user_updated_at: number
}

function stripStreamUrl(track: Track): Track {
  const { streamUrl: _streamUrl, ...rest } = track
  return rest
}

function sanitizeQueue(queue: Track[]): Track[] {
  return queue.map(stripStreamUrl)
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function avatarUrl(row: Pick<MemberRow, 'avatar_kind' | 'avatar_value' | 'user_updated_at'>): string | null {
  if (row.avatar_kind !== 'uploaded' || !row.avatar_value) return null
  return `/uploads/avatars/${encodeURIComponent(row.avatar_value)}?v=${row.user_updated_at}`
}

function toMember(row: MemberRow): RoomMember {
  return {
    id: row.user_id,
    nickname: row.nickname,
    role: row.role,
    avatarUrl: avatarUrl(row),
    isOnline: row.is_online === 1,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at,
  }
}

export function toOnlineUser(member: RoomMember): User {
  return {
    id: member.id,
    nickname: member.nickname,
    role: member.role,
    avatarUrl: member.avatarUrl,
  }
}

class PersistentRoomRepository {
  hydrateRooms(): RoomData[] {
    const rooms = getDatabase()
      .prepare('SELECT * FROM rooms WHERE deleted_at IS NULL ORDER BY created_at ASC')
      .all() as RoomRow[]

    return rooms.map((row) => {
      const members = this.getMembers(row.id).map((member) => ({ ...member, isOnline: false }))
      const playState = safeJson<PlayState>(row.play_state_json, {
        isPlaying: false,
        currentTime: 0,
        serverTimestamp: Date.now(),
      })
      return {
        id: row.id,
        name: row.name,
        password: row.password,
        creatorId: row.creator_id,
        hostId: row.host_id ?? row.creator_id,
        adminUserIds: new Set(members.filter((member) => member.role === 'admin').map((member) => member.id)),
        audioQuality: row.audio_quality as AudioQuality,
        isHidden: row.is_hidden === 1,
        users: [],
        members,
        queue: safeJson<Track[]>(row.queue_json, []),
        currentTrack: safeJson<Track | null>(row.current_track_json, null),
        playState: { ...playState, isPlaying: false, serverTimestamp: Date.now() },
        playMode: row.play_mode as PlayMode,
      }
    })
  }

  persistRoom(room: RoomData): void {
    const now = Date.now()
    getDatabase()
      .prepare(`
        INSERT INTO rooms (
          id, name, password, creator_id, host_id, audio_quality, play_mode, queue_json,
          current_track_json, play_state_json, is_hidden, created_at, updated_at, deleted_at
        ) VALUES (
          @id, @name, @password, @creatorId, @hostId, @audioQuality, @playMode, @queueJson,
          @currentTrackJson, @playStateJson, @isHidden, @now, @now, NULL
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          password = excluded.password,
          host_id = excluded.host_id,
          audio_quality = excluded.audio_quality,
          is_hidden = excluded.is_hidden,
          play_mode = excluded.play_mode,
          queue_json = excluded.queue_json,
          current_track_json = excluded.current_track_json,
          play_state_json = excluded.play_state_json,
          updated_at = excluded.updated_at
      `)
      .run({
        id: room.id,
        name: room.name,
        password: room.password,
        creatorId: room.creatorId,
        hostId: room.hostId,
        audioQuality: room.audioQuality,
        isHidden: room.isHidden ? 1 : 0,
        playMode: room.playMode,
        queueJson: JSON.stringify(sanitizeQueue(room.queue)),
        currentTrackJson: room.currentTrack ? JSON.stringify(stripStreamUrl(room.currentTrack)) : null,
        playStateJson: JSON.stringify(room.playState),
        now,
      })
  }

  getMembers(roomId: string): RoomMember[] {
    const rows = getDatabase()
      .prepare(`
        SELECT rm.*, u.nickname, u.avatar_kind, u.avatar_value, u.updated_at AS user_updated_at
        FROM room_members rm
        JOIN users u ON u.id = rm.user_id
        WHERE rm.room_id = ?
        ORDER BY rm.joined_at ASC
      `)
      .all(roomId) as MemberRow[]
    return rows.map(toMember)
  }

  getMember(roomId: string, userId: string): RoomMember | null {
    const row = getDatabase()
      .prepare(`
        SELECT rm.*, u.nickname, u.avatar_kind, u.avatar_value, u.updated_at AS user_updated_at
        FROM room_members rm
        JOIN users u ON u.id = rm.user_id
        WHERE rm.room_id = ? AND rm.user_id = ?
      `)
      .get(roomId, userId) as MemberRow | undefined
    return row ? toMember(row) : null
  }

  upsertMember(roomId: string, profile: { id: string; nickname: string; avatarUrl?: string | null }, role: UserRole): RoomMember {
    const now = Date.now()
    getDatabase()
      .prepare(`
        INSERT INTO room_members (room_id, user_id, role, joined_at, last_seen_at, is_online)
        VALUES (@roomId, @userId, @role, @now, @now, 1)
        ON CONFLICT(room_id, user_id) DO UPDATE SET
          role = CASE WHEN room_members.role = 'owner' THEN room_members.role ELSE excluded.role END,
          last_seen_at = excluded.last_seen_at,
          is_online = 1
      `)
      .run({ roomId, userId: profile.id, role, now })
    return this.getMember(roomId, profile.id) ?? {
      id: profile.id,
      nickname: profile.nickname,
      role,
      avatarUrl: profile.avatarUrl ?? null,
      isOnline: true,
      joinedAt: now,
      lastSeenAt: now,
    }
  }

  setMemberOnline(roomId: string, userId: string, isOnline: boolean): void {
    getDatabase()
      .prepare('UPDATE room_members SET is_online = @isOnline, last_seen_at = @now WHERE room_id = @roomId AND user_id = @userId')
      .run({ roomId, userId, isOnline: isOnline ? 1 : 0, now: Date.now() })
  }

  setMemberRole(roomId: string, userId: string, role: 'admin' | 'member'): void {
    getDatabase()
      .prepare("UPDATE room_members SET role = @role, last_seen_at = COALESCE(last_seen_at, @now) WHERE room_id = @roomId AND user_id = @userId AND role <> 'owner'")
      .run({ roomId, userId, role, now: Date.now() })
  }

  resetAllMembersOffline(): void {
    getDatabase().prepare('UPDATE room_members SET is_online = 0').run()
  }

  softDeleteRoom(roomId: string): void {
    getDatabase()
      .prepare('UPDATE rooms SET deleted_at = @now, updated_at = @now WHERE id = @roomId AND deleted_at IS NULL')
      .run({ roomId, now: Date.now() })
  }

  trimChatHistory(roomId: string): void {
    getDatabase()
      .prepare(`
        DELETE FROM chat_messages
        WHERE room_id = @roomId
          AND id NOT IN (
            SELECT id FROM chat_messages
            WHERE room_id = @roomId
            ORDER BY timestamp DESC
            LIMIT @limit
          )
      `)
      .run({ roomId, limit: LIMITS.CHAT_HISTORY_MAX })
  }
}

export const persistentRoomRepo = new PersistentRoomRepository()
