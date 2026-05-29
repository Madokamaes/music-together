import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SERVER_URL } from '@/lib/config'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  nickname?: string | null
  userId?: string | null
  avatarUrl?: string | null
  size?: 'sm' | 'default' | 'lg'
  isOnline?: boolean
  className?: string
}

function initials(nickname?: string | null, userId?: string | null): string {
  const source = nickname?.trim() || userId?.trim() || 'M'
  return source.slice(0, 1).toUpperCase()
}

function resolveAvatarUrl(avatarUrl?: string | null): string | undefined {
  if (!avatarUrl) return undefined
  if (/^https?:\/\//.test(avatarUrl)) return avatarUrl
  return `${SERVER_URL}${avatarUrl.startsWith('/') ? avatarUrl : `/${avatarUrl}`}`
}

function hueFor(seed?: string | null): number {
  const source = seed || 'music'
  let hash = 0
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) % 360
  return hash
}

export function UserAvatar({ nickname, userId, avatarUrl, size = 'default', isOnline, className }: UserAvatarProps) {
  const hue = hueFor(userId || nickname)
  return (
    <Avatar size={size} className={cn('border border-white/10 shadow-[0_8px_24px_rgb(0_0_0/22%)]', className)}>
      <AvatarImage src={resolveAvatarUrl(avatarUrl)} alt={nickname ? `${nickname} 的头像` : '用户头像'} className="object-cover" />
      <AvatarFallback
        className="font-semibold text-white"
        style={{
          background: `radial-gradient(circle at 30% 20%, hsl(${hue} 88% 72%), hsl(${(hue + 38) % 360} 72% 42%) 58%, hsl(${(hue + 78) % 360} 70% 24%))`,
        }}
      >
        {initials(nickname, userId)}
      </AvatarFallback>
      {typeof isOnline === 'boolean' && (
        <AvatarBadge className={cn(isOnline ? 'bg-[#63c98f]' : 'bg-muted-foreground')} aria-hidden />
      )}
    </Avatar>
  )
}
