import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import type { UserProfile } from '@music-together/shared'
import { getDatabase } from '../persistence/database.js'
import { config } from '../config.js'
import type { PasswordHashRecord } from '../services/passwordService.js'

interface UserRow {
  id: string
  nickname: string
  avatar_kind: string
  avatar_value: string | null
  created_at: number
  updated_at: number
  last_seen_at: number | null
}

interface PasswordRow {
  user_id: string
  salt: string
  hash: string
  params_json: string
  created_at: number
  updated_at: number
}

function toAvatarUrl(row: Pick<UserRow, 'avatar_kind' | 'avatar_value' | 'updated_at'>): string | null {
  if (row.avatar_kind !== 'uploaded' || !row.avatar_value) return null
  return `/uploads/avatars/${encodeURIComponent(row.avatar_value)}?v=${row.updated_at}`
}

function hasPassword(userId: string): boolean {
  const row = getDatabase().prepare('SELECT user_id FROM user_passwords WHERE user_id = ?').get(userId) as { user_id: string } | undefined
  return Boolean(row)
}

function toProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: toAvatarUrl(row),
    hasPassword: hasPassword(row.id),
  }
}

class UserRepository {
  ensureUser(userId: string, nickname = ''): UserProfile {
    const now = Date.now()
    getDatabase()
      .prepare(`
        INSERT INTO users (id, nickname, avatar_kind, avatar_value, created_at, updated_at, last_seen_at)
        VALUES (@id, @nickname, 'default', NULL, @now, @now, @now)
        ON CONFLICT(id) DO UPDATE SET
          nickname = CASE WHEN excluded.nickname <> '' THEN excluded.nickname ELSE users.nickname END,
          updated_at = CASE WHEN excluded.nickname <> '' AND excluded.nickname <> users.nickname THEN excluded.updated_at ELSE users.updated_at END,
          last_seen_at = excluded.last_seen_at
      `)
      .run({ id: userId, nickname: nickname.trim(), now })
    return this.getProfile(userId) ?? { id: userId, nickname: nickname.trim(), avatarUrl: null, hasPassword: false }
  }

  getProfile(userId: string): UserProfile | null {
    const row = getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined
    return row ? toProfile(row) : null
  }

  getProfiles(userIds: string[]): Map<string, UserProfile> {
    const uniqueIds = Array.from(new Set(userIds)).filter(Boolean)
    const profiles = new Map<string, UserProfile>()
    for (const id of uniqueIds) {
      const profile = this.getProfile(id)
      if (profile) profiles.set(id, profile)
    }
    return profiles
  }

  updateProfile(userId: string, update: { nickname?: string }): UserProfile {
    this.ensureUser(userId)
    const nickname = update.nickname?.trim()
    getDatabase()
      .prepare('UPDATE users SET nickname = COALESCE(@nickname, nickname), updated_at = @now, last_seen_at = @now WHERE id = @id')
      .run({ id: userId, nickname: nickname || null, now: Date.now() })
    return this.getProfile(userId)!
  }

  setUploadedAvatar(userId: string, avatarValue: string): UserProfile {
    this.ensureUser(userId)
    const oldRow = getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined
    getDatabase()
      .prepare(
        "UPDATE users SET avatar_kind = 'uploaded', avatar_value = @avatarValue, updated_at = @now, last_seen_at = @now WHERE id = @id",
      )
      .run({ id: userId, avatarValue, now: Date.now() })
    if (oldRow?.avatar_kind === 'uploaded' && oldRow.avatar_value && oldRow.avatar_value !== avatarValue) {
      this.deleteAvatarFile(oldRow.avatar_value)
    }
    return this.getProfile(userId)!
  }

  resetAvatar(userId: string): UserProfile {
    this.ensureUser(userId)
    const oldRow = getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined
    getDatabase()
      .prepare("UPDATE users SET avatar_kind = 'default', avatar_value = NULL, updated_at = @now, last_seen_at = @now WHERE id = @id")
      .run({ id: userId, now: Date.now() })
    if (oldRow?.avatar_kind === 'uploaded' && oldRow.avatar_value) {
      this.deleteAvatarFile(oldRow.avatar_value)
    }
    return this.getProfile(userId)!
  }

  hasPassword(userId: string): boolean {
    return hasPassword(userId)
  }

  getPasswordRecord(userId: string): PasswordHashRecord | null {
    const row = getDatabase().prepare('SELECT * FROM user_passwords WHERE user_id = ?').get(userId) as PasswordRow | undefined
    if (!row) return null
    return {
      salt: row.salt,
      hash: row.hash,
      paramsJson: row.params_json,
    }
  }

  setPassword(userId: string, record: PasswordHashRecord): UserProfile {
    this.ensureUser(userId)
    const now = Date.now()
    getDatabase()
      .prepare(`
        INSERT INTO user_passwords (user_id, salt, hash, params_json, created_at, updated_at)
        VALUES (@userId, @salt, @hash, @paramsJson, @now, @now)
        ON CONFLICT(user_id) DO UPDATE SET
          salt = excluded.salt,
          hash = excluded.hash,
          params_json = excluded.params_json,
          updated_at = excluded.updated_at
      `)
      .run({ userId, salt: record.salt, hash: record.hash, paramsJson: record.paramsJson, now })
    return this.getProfile(userId)!
  }

  private deleteAvatarFile(fileName: string): void {
    const target = path.join(config.persistence.avatarDir, fileName)
    if (!target.startsWith(config.persistence.avatarDir)) return
    if (existsSync(target)) rmSync(target, { force: true })
  }
}

export const userRepo = new UserRepository()
