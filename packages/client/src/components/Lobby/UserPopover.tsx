import { useEffect, useRef, useState } from 'react'
import { LIMITS } from '@music-together/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { UserAvatar } from '@/components/UserAvatar'
import { fetchMyProfile, resetMyAvatar, updateMyProfile, uploadMyAvatar } from '@/lib/profileApi'
import { storage } from '@/lib/storage'
import { toast } from 'sonner'

export function UserPopover() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nickname, setNickname] = useState(storage.getNickname())
  const [avatarUrl, setAvatarUrl] = useState(storage.getAvatarUrl())
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const prevValueRef = useRef(storage.getNickname())

  const syncProfile = (profile: { nickname: string; avatarUrl?: string | null }) => {
    storage.setNickname(profile.nickname)
    storage.setAvatarUrl(profile.avatarUrl ?? '')
    setNickname(profile.nickname)
    setAvatarUrl(profile.avatarUrl ?? '')
    prevValueRef.current = profile.nickname
  }

  const handleSave = async () => {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed === prevValueRef.current || isSaving) return

    setIsSaving(true)
    try {
      const profile = await updateMyProfile({ nickname: trimmed })
      syncProfile(profile)
      toast.success('昵称已保存')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '昵称保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpload = async (file: File | undefined) => {
    if (!file || isUploading) return
    setIsUploading(true)
    try {
      const profile = await uploadMyAvatar(file)
      syncProfile(profile)
      toast.success('头像已更新')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '头像上传失败')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleResetAvatar = async () => {
    if (isUploading) return
    setIsUploading(true)
    try {
      const profile = await resetMyAvatar()
      syncProfile(profile)
      toast.success('头像已重置')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '头像重置失败')
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    void fetchMyProfile()
      .then(syncProfile)
      .catch(() => null)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleSave()
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const current = storage.getNickname()
      setNickname(current)
      setAvatarUrl(storage.getAvatarUrl())
      prevValueRef.current = current
      void fetchMyProfile()
        .then(syncProfile)
        .catch(() => null)
    }
    setOpen(nextOpen)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/60 p-0">
          <UserAvatar nickname={storage.getNickname()} userId={storage.getUserId()} avatarUrl={avatarUrl} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar nickname={nickname} userId={storage.getUserId()} avatarUrl={avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">个人设置</p>
              <p className="truncate text-xs text-muted-foreground">{nickname ? `当前昵称: ${nickname}` : '尚未设置昵称'}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">昵称</label>
            <Input
              placeholder="输入昵称..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={() => void handleSave()}
              onKeyDown={handleKeyDown}
              maxLength={LIMITS.NICKNAME_MAX_LENGTH}
              className="h-8 text-sm"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">头像</label>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => void handleUpload(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                上传头像
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleResetAvatar()} disabled={isUploading}>
                重置
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/70">支持 PNG、JPEG、WebP，最大 1MB。</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
