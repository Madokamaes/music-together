import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config.js'

let database: Database.Database | null = null

export function initDatabase(): Database.Database {
  if (database) return database

  mkdirSync(dirname(config.persistence.databasePath), { recursive: true })
  mkdirSync(config.persistence.avatarDir, { recursive: true })

  database = new Database(config.persistence.databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  database.pragma('busy_timeout = 5000')
  return database
}

export function getDatabase(): Database.Database {
  return database ?? initDatabase()
}

export function closeDatabase(): void {
  database?.close()
  database = null
}
