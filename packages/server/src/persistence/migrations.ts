import { getDatabase } from './database.js'

const MIGRATIONS: Array<{ version: number; statements: string[] }> = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL DEFAULT '',
        avatar_kind TEXT NOT NULL DEFAULT 'default',
        avatar_value TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_seen_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        password TEXT,
        creator_id TEXT NOT NULL,
        host_id TEXT,
        audio_quality INTEGER NOT NULL,
        play_mode TEXT NOT NULL,
        queue_json TEXT NOT NULL DEFAULT '[]',
        current_track_json TEXT,
        play_state_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        FOREIGN KEY (creator_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS room_members (
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
        joined_at INTEGER NOT NULL,
        last_seen_at INTEGER,
        is_online INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        nickname_snapshot TEXT NOT NULL,
        avatar_url_snapshot TEXT,
        content TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('user', 'system')),
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time ON chat_messages(room_id, timestamp)`,
      `CREATE TABLE IF NOT EXISTS listening_events (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        url_id TEXT NOT NULL,
        title TEXT NOT NULL,
        artists_json TEXT NOT NULL,
        album TEXT,
        duration INTEGER,
        cover TEXT,
        track_json TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        started_by_user_id TEXT,
        online_count INTEGER NOT NULL,
        audio_quality INTEGER NOT NULL,
        play_mode TEXT NOT NULL,
        room_name_snapshot TEXT,
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_listening_events_room_time ON listening_events(room_id, started_at)`,
      `CREATE TABLE IF NOT EXISTS listening_event_users (
        event_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        nickname_snapshot TEXT NOT NULL,
        avatar_url_snapshot TEXT,
        role_snapshot TEXT NOT NULL,
        PRIMARY KEY (event_id, user_id),
        FOREIGN KEY (event_id) REFERENCES listening_events(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_listening_event_users_user ON listening_event_users(user_id)`,
    ],
  },
]

export function runMigrations(): void {
  const db = getDatabase()
  db.pragma('user_version')
  const current = (db.pragma('user_version', { simple: true }) as number) ?? 0

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue
    const run = db.transaction(() => {
      for (const statement of migration.statements) {
        db.prepare(statement).run()
      }
      db.pragma(`user_version = ${migration.version}`)
    })
    run()
  }
}
