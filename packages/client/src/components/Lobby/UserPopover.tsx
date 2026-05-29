import { useEffect, useRef, useState } from 'react'
import { LIMITS } from '@music-together/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { UserAvatar } from '@/components/UserAvatar'
import { fetchMyProfile, loginWithPassword, resetMyAvatar, updateMyPassword, updateMyProfile, uploadMyAvatar } from '@/lib/profileApi'
import { storage } from '@/lib/storage'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'

export function UserPopover() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nickname, setNickname] = useState(storage.getNickname())
  const [avatarUrl, setAvatarUrl] = useState(storage.getAvatarUrl())
  const [accountId, setAccountId] = useState(storage.getUserId())
  const [hasPassword, setHasPassword] = useState(false)
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const [loginAccountId, setLoginAccountId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const prevValueRef = useRef(storage.getNickname())

  const syncProfile = (profile: { id: string; nickname: string; avatarUrl?: string | null; hasPassword: boolean }) => {
    storage.setUserId(profile.id)
    storage.setNickname(profile.nickname)
    storage.setAvatarUrl(profile.avatarUrl ?? '')
    setAccountId(profile.id)
    setNickname(profile.nickname)
    setAvatarUrl(profile.avatarUrl ?? '')
    setHasPassword(profile.hasPassword)
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

  const handleCopyAccountId = () => {
    if (!accountId) return
    navigator.clipboard.writeText(accountId)
    toast.success('账号 ID 已复制')
  }

  const handlePasswordSave = async () => {
    if (isPasswordSaving) return
    if (hasPassword) {
      toast.error('暂不支持重置或修改密码')
      return
    }
    if (newPassword.length === 0) {
      toast.error('请输入密码')
      return
    }

    setIsPasswordSaving(true)
    try {
      const profile = await updateMyPassword({ password: newPassword })
      syncProfile(profile)
      setNewPassword('')
      toast.success('密码已设置')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '密码保存失败')
    } finally {
      setIsPasswordSaving(false)
    }
  }

  const handlePasswordLogin = async () => {
    if (isLoggingIn) return
    if (!loginAccountId.trim() || loginPassword.length === 0) {
      toast.error('请输入账号 ID 和密码')
      return
    }

    setIsLoggingIn(true)
    try {
      const profile = await loginWithPassword({ accountId: loginAccountId.trim(), password: loginPassword })
      syncProfile(profile)
      toast.success('账号已恢复，正在刷新身份')
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登录失败')
    } finally {
      setIsLoggingIn(false)
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
      setAccountId(storage.getUserId())
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
            <label className="text-xs font-medium text-muted-foreground">账号 ID</label>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{accountId || '初始化中'}</code>
              <Button type="button" variant="ghost" size="icon-sm" onClick={handleCopyAccountId} disabled={!accountId} aria-label="复制账号 ID">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/70">保存账号 ID 后，可用它和密码在其他浏览器找回账号。</p>
          </div>

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
            <p className="text-[11px] text-muted-foreground/70">支持 PNG、JPEG、WebP，最大 5MB；上传后会自动压缩为 WebP。</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">账号密码</label>
              <Badge variant={hasPassword ? 'secondary' : 'outline'}>{hasPassword ? '已设置密码' : '未设置密码'}</Badge>
            </div>
            {hasPassword ? (
              <p className="text-[11px] text-muted-foreground/70">已设置的密码可用于账号找回；暂不支持重置或修改。</p>
            ) : (
              <>
                <Input
                  type="password"
                  placeholder="设置密码"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handlePasswordSave()}
                  className="h-8 text-sm"
                  disabled={isPasswordSaving}
                />
                <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => void handlePasswordSave()} disabled={isPasswordSaving}>
                  设置密码
                </Button>
                <p className="text-[11px] text-muted-foreground/70">密码不会限制字符类型；请同时保存账号 ID。</p>
              </>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">用账号 ID 和密码登录/找回</label>
            <Input
              placeholder="账号 ID"
              value={loginAccountId}
              onChange={(e) => setLoginAccountId(e.target.value)}
              className="h-8 text-sm"
              disabled={isLoggingIn}
            />
            <Input
              type="password"
              placeholder="密码"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handlePasswordLogin()}
              className="h-8 text-sm"
              disabled={isLoggingIn}
            />
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void handlePasswordLogin()} disabled={isLoggingIn}>
              登录并恢复账号
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
