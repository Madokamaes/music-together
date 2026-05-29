import type { ChatMessage } from '@music-together/shared'
import { LIMITS } from '@music-together/shared'
import { getDatabase } from '../persistence/database.js'
import type { ChatRepository } from './types.js'

export class InMemoryChatRepository implements ChatRepository {
  private history = new Map<string, ChatMessage[]>()

  getHistory(roomId: string): ChatMessage[] {
    return this.history.get(roomId) ?? []
  }

  addMessage(roomId: string, message: ChatMessage): void {
    const messages = this.history.get(roomId)
    if (!messages) return
    messages.push(message)
    if (messages.length > LIMITS.CHAT_HISTORY_MAX) {
      messages.splice(0, messages.length - LIMITS.CHAT_HISTORY_MAX)
    }
    getDatabase()
      .prepare(`
        INSERT INTO chat_messages (id, room_id, user_id, nickname_snapshot, avatar_url_snapshot, content, type, timestamp)
        VALUES (@id, @roomId, @userId, @nickname, @avatarUrl, @content, @type, @timestamp)
      `)
      .run({
        id: message.id,
        roomId,
        userId: message.userId,
        nickname: message.nickname,
        avatarUrl: message.avatarUrl ?? null,
        content: message.content,
        type: message.type,
        timestamp: message.timestamp,
      })
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

  createRoom(roomId: string): void {
    const rows = getDatabase()
      .prepare(`
        SELECT id, user_id, nickname_snapshot, avatar_url_snapshot, content, type, timestamp
        FROM chat_messages
        WHERE room_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      .all(roomId, LIMITS.CHAT_HISTORY_MAX) as Array<{
      id: string
      user_id: string
      nickname_snapshot: string
      avatar_url_snapshot: string | null
      content: string
      type: 'user' | 'system'
      timestamp: number
    }>
    this.history.set(
      roomId,
      rows
        .reverse()
        .map((row) => ({
          id: row.id,
          userId: row.user_id,
          nickname: row.nickname_snapshot,
          avatarUrl: row.avatar_url_snapshot,
          content: row.content,
          type: row.type,
          timestamp: row.timestamp,
        })),
    )
  }

  deleteRoom(roomId: string): void {
    this.history.delete(roomId)
  }
}

/** Singleton instance */
export const chatRepo = new InMemoryChatRepository()
