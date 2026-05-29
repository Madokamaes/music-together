import express, { Router, type Router as RouterType, type Request, type Response } from 'express'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { EVENTS, userProfileUpdateSchema } from '@music-together/shared'
import { config } from '../config.js'
import { userRepo } from '../repositories/userRepository.js'
import { roomRepo } from '../repositories/roomRepository.js'
import { persistentRoomRepo } from '../repositories/persistentRoomRepository.js'
import { toPublicRoomState, toPublicRoomStateForOwner } from '../utils/roomUtils.js'
import type { TypedServer } from '../middleware/types.js'

const AVATAR_LIMIT_BYTES = 1024 * 1024
const AVATAR_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

function requireUserId(req: Request, res: Response): string | null {
  if (req.identityUserId) return req.identityUserId
  res.status(401).json({ error: 'UNAUTHENTICATED' })
  return null
}

function syncProfileToRooms(userId: string, io?: TypedServer): void {
  const profile = userRepo.getProfile(userId)
  if (!profile) return

  for (const room of roomRepo.getAll().values()) {
    const member = room.members.find((m) => m.id === userId)
    if (!member) continue

    member.nickname = profile.nickname
    member.avatarUrl = profile.avatarUrl ?? null
    const online = room.users.find((u) => u.id === userId)
    if (online) {
      online.nickname = profile.nickname
      online.avatarUrl = profile.avatarUrl ?? null
    }
    persistentRoomRepo.persistRoom(room)
    if (io) {
      const ownerSocketId = roomRepo.getSocketIdForUser(room.id, room.creatorId)
      if (ownerSocketId) io.to(ownerSocketId).emit(EVENTS.ROOM_STATE, toPublicRoomStateForOwner(room))
      if (ownerSocketId) {
        io.to(room.id).except(ownerSocketId).emit(EVENTS.ROOM_STATE, toPublicRoomState(room))
      } else {
        io.to(room.id).emit(EVENTS.ROOM_STATE, toPublicRoomState(room))
      }
    }
  }
}

export function createUserRoutes(io?: TypedServer): RouterType {
  const router: RouterType = Router()
  router.get('/me', (req, res) => {
    const userId = requireUserId(req, res)
    if (!userId) return
    res.json(userRepo.ensureUser(userId))
  })

  router.patch('/me', (req, res) => {
    const userId = requireUserId(req, res)
    if (!userId) return
    const parsed = userProfileUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? '输入格式错误' })
      return
    }
    const profile = userRepo.updateProfile(userId, parsed.data)
    syncProfileToRooms(userId, io)
    res.json(profile)
  })

  router.post('/me/avatar', express.raw({ limit: AVATAR_LIMIT_BYTES, type: Object.keys(AVATAR_TYPES) }), (req, res) => {
    const userId = requireUserId(req, res)
    if (!userId) return
    const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
    const ext = AVATAR_TYPES[contentType]
    if (!ext) {
      res.status(415).json({ error: '仅支持 PNG/JPEG/WebP 头像' })
      return
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    if (body.length === 0 || body.length > AVATAR_LIMIT_BYTES) {
      res.status(400).json({ error: '头像大小需在 1MB 以内' })
      return
    }

    mkdirSync(config.persistence.avatarDir, { recursive: true })
    const fileName = `${userId}-${randomUUID()}.${ext}`
    writeFileSync(path.join(config.persistence.avatarDir, fileName), body)
    const profile = userRepo.setUploadedAvatar(userId, fileName)
    syncProfileToRooms(userId, io)
    res.json(profile)
  })

  router.delete('/me/avatar', (req, res) => {
    const userId = requireUserId(req, res)
    if (!userId) return
    const profile = userRepo.resetAvatar(userId)
    syncProfileToRooms(userId, io)
    res.json(profile)
  })

  return router
}

export default createUserRoutes
