import { nanoid } from 'nanoid'
import type { RoomData } from './types.js'
import type { Track } from '@music-together/shared'
import { getDatabase } from '../persistence/database.js'
import { config } from '../config.js'

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function stripStreamUrl(track: Track): Track {
  const { streamUrl: _streamUrl, ...rest } = track
  return rest
}

class ListeningStatsRepository {
  private lastCleanupAt = 0

  recordPlaybackStart(room: RoomData, track: Track): void {
    const eventId = nanoid(20)
    const startedAt = Date.now()
    this.cleanupExpiredEvents(startedAt)
    const sanitizedTrack = stripStreamUrl(track)
    const db = getDatabase()
    const run = db.transaction(() => {
      db.prepare(`
        INSERT INTO listening_events (
          id, room_id, track_id, source, source_id, url_id, title, artists_json, album,
          duration, cover, track_json, started_at, started_by_user_id, online_count,
          audio_quality, play_mode, room_name_snapshot
        ) VALUES (
          @id, @roomId, @trackId, @source, @sourceId, @urlId, @title, @artistsJson, @album,
          @duration, @cover, @trackJson, @startedAt, @startedByUserId, @onlineCount,
          @audioQuality, @playMode, @roomNameSnapshot
        )
      `).run({
        id: eventId,
        roomId: room.id,
        trackId: track.id,
        source: track.source,
        sourceId: track.sourceId,
        urlId: track.urlId,
        title: track.title,
        artistsJson: JSON.stringify(track.artist),
        album: track.album,
        duration: track.duration,
        cover: track.cover,
        trackJson: JSON.stringify(sanitizedTrack),
        startedAt,
        startedByUserId: room.hostId,
        onlineCount: room.users.length,
        audioQuality: room.audioQuality,
        playMode: room.playMode,
        roomNameSnapshot: room.name,
      })

      const insertUser = db.prepare(`
        INSERT INTO listening_event_users (event_id, user_id, nickname_snapshot, avatar_url_snapshot, role_snapshot)
        VALUES (@eventId, @userId, @nickname, @avatarUrl, @role)
      `)
      for (const user of room.users) {
        insertUser.run({
          eventId,
          userId: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl ?? null,
          role: user.role,
        })
      }
    })
    run()
  }

  cleanupExpiredEvents(now = Date.now()): void {
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return

    const cutoff = now - config.listeningStats.retentionDays * DAY_MS
    const db = getDatabase()
    const run = db.transaction(() => {
      db.prepare(`
        DELETE FROM listening_event_users
        WHERE event_id IN (SELECT id FROM listening_events WHERE started_at < ?)
      `).run(cutoff)
      db.prepare('DELETE FROM listening_events WHERE started_at < ?').run(cutoff)
    })
    run()
    this.lastCleanupAt = now
  }
}

export const listeningStatsRepo = new ListeningStatsRepository()
