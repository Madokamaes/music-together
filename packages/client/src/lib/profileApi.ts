import type { UserProfile } from '@music-together/shared'
import { SERVER_URL } from './config'

export const AVATAR_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024

async function parseProfileResponse(res: Response): Promise<UserProfile> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? '资料保存失败')
  }
  return (await res.json()) as UserProfile
}

export async function fetchMyProfile(): Promise<UserProfile> {
  const res = await fetch(`${SERVER_URL}/api/users/me`, { credentials: 'include' })
  return parseProfileResponse(res)
}

export async function updateMyProfile(update: { nickname?: string }): Promise<UserProfile> {
  const res = await fetch(`${SERVER_URL}/api/users/me`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
  return parseProfileResponse(res)
}

export async function updateMyPassword(update: { password: string; currentPassword?: string }): Promise<UserProfile> {
  const res = await fetch(`${SERVER_URL}/api/users/me/password`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
  return parseProfileResponse(res)
}

export async function loginWithPassword(input: { accountId: string; password: string }): Promise<UserProfile> {
  const res = await fetch(`${SERVER_URL}/api/auth/password/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseProfileResponse(res)
}

export async function uploadMyAvatar(file: File): Promise<UserProfile> {
  if (file.size > AVATAR_UPLOAD_LIMIT_BYTES) throw new Error('头像大小需在 5MB 以内')
  const res = await fetch(`${SERVER_URL}/api/users/me/avatar`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  return parseProfileResponse(res)
}

export async function resetMyAvatar(): Promise<UserProfile> {
  const res = await fetch(`${SERVER_URL}/api/users/me/avatar`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return parseProfileResponse(res)
}
