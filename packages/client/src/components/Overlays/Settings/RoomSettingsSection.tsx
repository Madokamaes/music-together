import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { UserAvatar } from '@/components/UserAvatar'
import { resetMyAvatar, updateMyProfile, uploadMyAvatar } from '@/lib/profileApi'
import { storage } from '@/lib/storage'
import { usePlayerStore } from '@/stores/playerStore'
import { useRoomStore } from '@/stores/roomStore'
import type { AudioQuality } from '@music-together/shared'
import { LIMITS } from '@music-together/shared'
import { Check, Copy, Lock, LockOpen, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SettingRow } from './SettingRow'

const QUALITY_OPTIONS: { value: AudioQuality; label: string; description?: string }[] = [
  { value: 128, label: '标准 128kbps' },
  { value: 192, label: '较高 192kbps' },
  { value: 320, label: 'HQ 320kbps' },
  { value: 999, label: '无损 SQ', description: '需要 VIP 账号' },
]

function getQualityLabel(quality: AudioQuality): string {
  return QUALITY_OPTIONS.find((o) => o.value === quality)?.label ?? `${quality}kbps`
}

interface RoomSettingsSectionProps {
  onUpdateSettings: (settings: { name?: string; password?: string | null; audioQuality?: AudioQuality }) => void
  onDeleteRoom?: () => void
}

export function RoomSettingsSection({ onUpdateSettings, onDeleteRoom }: RoomSettingsSectionProps) {
  const room = useRoomStore((s) => s.room)
  const currentUser = useRoomStore((s) => s.currentUser)
  const roomPassword = useRoomStore((s) => s.roomPassword)
  const syncDrift = usePlayerStore((s) => s.syncDrift)
  const isOwner = currentUser?.role === 'owner'

  const driftDisplay = useMemo(() => {
    const ms = Math.round(syncDrift * 1000)
    const label = ms > 0 ? `+${ms}ms` : `${ms}ms`
    const isHigh = Math.abs(ms) > 500
    return { label, isHigh }
  }, [syncDrift])
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordEnabled, setPasswordEnabled] = useState(room?.hasPassword ?? false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nickname, setNickname] = useState(storage.getNickname())
  const [avatarUrl, setAvatarUrl] = useState(storage.getAvatarUrl())
  const [isProfileSaving, setIsProfileSaving] = useState(false)
  const [isAvatarSaving, setIsAvatarSaving] = useState(false)

  const syncProfile = (profile: { nickname: string; avatarUrl?: string | null }) => {
    storage.setNickname(profile.nickname)
    storage.setAvatarUrl(profile.avatarUrl ?? '')
    setNickname(profile.nickname)
    setAvatarUrl(profile.avatarUrl ?? '')
  }

  const handleNicknameBlur = async () => {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed === storage.getNickname() || isProfileSaving) return

    setIsProfileSaving(true)
    try {
      const profile = await updateMyProfile({ nickname: trimmed })
      syncProfile(profile)
      toast.success('昵称已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '昵称保存失败')
    } finally {
      setIsProfileSaving(false)
    }
  }

  const handleAvatarUpload = async (file: File | undefined) => {
    if (!file || isAvatarSaving) return
    setIsAvatarSaving(true)
    try {
      const profile = await uploadMyAvatar(file)
      syncProfile(profile)
      toast.success('头像已更新')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '头像上传失败')
    } finally {
      setIsAvatarSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAvatarReset = async () => {
    if (isAvatarSaving) return
    setIsAvatarSaving(true)
    try {
      const profile = await resetMyAvatar()
      syncProfile(profile)
      toast.success('头像已重置')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '头像重置失败')
    } finally {
      setIsAvatarSaving(false)
    }
  }

  // Room name editing state
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    setPasswordEnabled(room?.hasPassword ?? false)
    setPasswordInput('')
  }, [room?.hasPassword])

  const copyRoomLink = () => {
    const url = `${window.location.origin}/room/${room?.id}`
    navigator.clipboard.writeText(url)
    toast.success('房间链接已复制')
  }

  const handlePasswordToggle = (checked: boolean) => {
    if (!checked) {
      setPasswordEnabled(false)
      setPasswordInput('')
      onUpdateSettings({ password: null })
      toast.success('密码已移除')
    } else {
      setPasswordEnabled(true)
    }
  }

  const handleSetPassword = () => {
    if (!passwordInput.trim()) {
      toast.error('请输入密码')
      return
    }
    onUpdateSettings({ password: passwordInput.trim() })
    toast.success('密码已设置')
  }

  const handleStartEditName = () => {
    setNameInput(room?.name ?? '')
    setEditingName(true)
  }

  const handleSaveName = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) {
      toast.error('房间名不能为空')
      return
    }
    if (trimmed === room?.name) {
      setEditingName(false)
      return
    }
    onUpdateSettings({ name: trimmed })
    setEditingName(false)
    toast.success('房间名已更新')
  }

  const handleCancelEditName = () => {
    setEditingName(false)
    setNameInput('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">房间信息</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="房间名">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={LIMITS.ROOM_NAME_MAX_LENGTH}
                className="h-7 w-40 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') handleCancelEditName()
                }}
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveName}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEditName}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{room?.name}</span>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleStartEditName}
                  aria-label="编辑房间名"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </SettingRow>

        <SettingRow label="房间号">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-0.5 text-sm">{room?.id}</code>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={copyRoomLink}
                  aria-label="复制房间链接"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制房间链接</TooltipContent>
            </Tooltip>
          </div>
        </SettingRow>

        <SettingRow label="同步偏移">
          <span className={`text-sm font-mono ${driftDisplay.isHigh ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {driftDisplay.label}
          </span>
        </SettingRow>

        <SettingRow label="音质" description={isOwner ? '切换后对下一首歌生效' : undefined}>
          {isOwner ? (
            <Select
              value={String(room?.audioQuality ?? 320)}
              onValueChange={(v) => {
                const quality = Number(v) as AudioQuality
                onUpdateSettings({ audioQuality: quality })
                toast.success(`音质已切换为 ${getQualityLabel(quality)}`)
              }}
            >
              <SelectTrigger className="h-8 w-[145px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    <div className="flex items-center gap-2">
                      <span>{opt.label}</span>
                      {opt.description && (
                        <span className="text-[10px] text-muted-foreground">({opt.description})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">{getQualityLabel(room?.audioQuality ?? 320)}</span>
          )}
        </SettingRow>

        <SettingRow label="密码保护">
          {room?.hasPassword ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> 已设置
              </Badge>
              {roomPassword && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <code
                      className="cursor-pointer rounded bg-muted px-2 py-0.5 text-xs transition-colors hover:bg-muted/80"
                      onClick={() => {
                        navigator.clipboard.writeText(roomPassword)
                        toast.success('密码已复制')
                      }}
                    >
                      {roomPassword}
                    </code>
                  </TooltipTrigger>
                  <TooltipContent>点击复制密码</TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="gap-1">
              <LockOpen className="h-3 w-3" /> 无密码
            </Badge>
          )}
        </SettingRow>
      </div>

      {isOwner && (
        <div>
          <h3 className="text-base font-semibold">房主设置</h3>
          <Separator className="mt-2 mb-4" />

          <SettingRow label="房间密码" description="开启后需输入密码才能进入">
            <Switch checked={passwordEnabled} onCheckedChange={handlePasswordToggle} />
          </SettingRow>

          {passwordEnabled && (
            <div className="flex gap-2 pb-2">
              <Input
                type="password"
                placeholder="输入新密码..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                maxLength={LIMITS.ROOM_PASSWORD_MAX_LENGTH}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
              />
              <Button size="sm" onClick={handleSetPassword}>
                确认
              </Button>
            </div>
          )}

          <SettingRow label="解散房间" description="解散后房间会从大厅移除，成员也会返回首页">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (window.confirm('确定要解散这个房间吗？此操作不可撤销。')) onDeleteRoom?.()
              }}
              disabled={!onDeleteRoom}
            >
              <Trash2 className="h-3.5 w-3.5" />
              解散房间
            </Button>
          </SettingRow>
        </div>
      )}

      {/* ---- 个人信息 ---- */}
      <div>
        <h3 className="text-base font-semibold">个人信息</h3>
        <Separator className="mt-2 mb-4" />

        <SettingRow label="头像">
          <div className="flex items-center gap-3">
            <UserAvatar nickname={nickname} userId={currentUser?.id ?? storage.getUserId()} avatarUrl={avatarUrl} size="lg" />
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => void handleAvatarUpload(e.target.files?.[0])}
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isAvatarSaving}>
                上传头像
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleAvatarReset()} disabled={isAvatarSaving}>
                重置
              </Button>
            </div>
          </div>
        </SettingRow>

        <SettingRow label="昵称" description="会同步到当前房间成员和聊天身份">
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onBlur={() => void handleNicknameBlur()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleNicknameBlur()
            }}
            className="w-40"
            placeholder="输入昵称..."
            disabled={isProfileSaving}
          />
        </SettingRow>
      </div>
    </div>
  )
}
