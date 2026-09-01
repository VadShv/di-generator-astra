'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { useState } from 'react'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  kdp: 'КДП',
  user: 'Пользователь',
}

export function UserMenu() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  if (!session?.user) return null

  const user = session.user as { email?: string; name?: string | null; role?: string }
  const displayName = user.name || user.email || 'Пользователь'
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const roleLabel = ROLE_LABELS[user.role || 'user'] || user.role || 'Пользователь'

  async function handleLogout() {
    setLoggingOut(true)
    // signOut с redirect: true → middleware перехватит /login и покажет форму.
    await signOut({ callbackUrl: '/login', redirect: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 px-2 gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs bg-violet-100 text-violet-700">
              {initials || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-xs font-medium max-w-[120px] truncate">{displayName}</span>
            <span className="text-[10px] text-muted-foreground">{roleLabel}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            <p className="text-xs leading-none text-muted-foreground mt-1">{roleLabel}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/?section=profile')}
          className="cursor-pointer"
        >
          <User className="mr-2 h-4 w-4" />
          Личный кабинет
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={loggingOut}
          className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {loggingOut ? 'Выход...' : 'Выйти из системы'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
