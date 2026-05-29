import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { UserAvatar } from '@/components/UserAvatar'
import { useRoomStore } from '@/stores/roomStore'
import type { UserRole } from '@music-together/shared'
import { Crown, Shield, User } from 'lucide-react'

interface MembersSectionProps {
  onSetUserRole?: (userId: string, role: 'admin' | 'member') => void
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: '房主',
  admin: '管理员',
  member: '成员',
}

const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, member: 2 }

function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'owner':
      return <Crown className="h-4 w-4 text-yellow-500" />
    case 'admin':
      return <Shield className="h-4 w-4 text-blue-400" />
    case 'member':
      return <User className="h-4 w-4 text-muted-foreground" />
  }
}

export function MembersSection({ onSetUserRole }: MembersSectionProps) {
  const room = useRoomStore((s) => s.room)
  const currentUser = useRoomStore((s) => s.currentUser)
  const isOwner = currentUser?.role === 'owner'
  const members = [...(room?.members ?? [])].sort((a, b) => {
    const roleDelta = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)
    if (roleDelta !== 0) return roleDelta
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
    return a.nickname.localeCompare(b.nickname)
  })

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">房间成员 ({room?.onlineCount ?? 0}/{room?.memberCount ?? members.length})</h3>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            离线成员会保留在房间名单中
          </Badge>
        </div>
        <Separator className="mt-2 mb-4" />

        <div className="space-y-1.5">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-white/[0.035]"
            >
              <UserAvatar
                nickname={member.nickname}
                userId={member.id}
                avatarUrl={member.avatarUrl}
                isOnline={member.isOnline}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  {getRoleIcon(member.role)}
                  <span className="truncate text-sm font-medium">{member.nickname}</span>
                  {member.id === currentUser?.id && (
                    <Badge variant="secondary" className="text-xs">
                      你
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {ROLE_LABELS[member.role]}
                  </Badge>
                  <span className={member.isOnline ? 'text-[11px] text-[#63c98f]' : 'text-[11px] text-muted-foreground/60'}>
                    {member.isOnline ? '在线' : '离线'}
                  </span>
                </div>
              </div>

              {isOwner && member.role !== 'owner' && member.id !== currentUser?.id && onSetUserRole && (
                <Select value={member.role} onValueChange={(v) => onSetUserRole(member.id, v as 'admin' | 'member')}>
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="member">成员</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
