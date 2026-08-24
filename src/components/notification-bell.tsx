'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useSession } from 'next-auth/react'

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  entityType: string | null
  entityId: string | null
  createdAt: string
}

const TYPE_ICONS: Record<string, string> = {
  mass_gen_complete: '✅',
  status_change: '🔄',
  audit_critical: '⚠️',
  system: 'ℹ️',
}

export function NotificationBell() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!session?.user) return
    try {
      const res = await fetch('/api/notifications?limit=20')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch { /* silent */ }
  }, [session?.user])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleMarkAll = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      })
      setItems(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch { /* silent */ }
  }

  const handleMarkOne = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* silent */ }
  }

  if (!session?.user) return null

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => { setOpen(!open); if (!open) fetchNotifications() }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border rounded-lg shadow-lg z-50">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="font-medium text-sm">Уведомления</span>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleMarkAll}>
                  <CheckCheck className="h-3 w-3 mr-1" /> Прочитать все
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-[300px]">
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Нет уведомлений</p>
              )}
              {items.map(n => (
                <div
                  key={n.id}
                  className={cn('p-3 border-b last:border-0 hover:bg-muted/30 cursor-pointer', !n.isRead && 'bg-blue-50/30')}
                  onClick={() => { if (!n.isRead) handleMarkOne(n.id) }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base">{TYPE_ICONS[n.type] || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(n.createdAt).toLocaleString('ru-RU')}
                      </p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  )
}
