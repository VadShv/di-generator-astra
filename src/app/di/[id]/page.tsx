'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, FileX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DIDetail } from '@/components/modules/di-detail'
import { useToast } from '@/hooks/use-toast'

interface DISection { id: string; sectionTitle: string; sectionContent: string; order: number; aiGenerated: boolean; editedBy?: string | null }
interface GeneratedDI {
  id: string; positionId: string; templateId?: string | null; title: string; status: string
  currentVersion: number; signedByEmployee: boolean; signedAt?: string | null
  position: { id: string; title: string; code: string; department: { id: string; name: string; company?: { id: string; name: string } | null }; grade?: string | null; businessFunction?: { id: string; name: string } | null }
  template?: { id: string; name: string; isPrimary: boolean } | null
  sections: DISection[]
  createdAt: string; updatedAt: string
}

export default function DIDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const [di, setDi] = useState<GeneratedDI | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/generate-di/${id}`)
        if (res.status === 404) { setNotFound(true); return }
        if (!res.ok) throw new Error()
        setDi(await res.json())
      } catch {
        toast({ title: 'Ошибка', description: 'Не удалось загрузить ДИ', variant: 'destructive' })
      } finally { setLoading(false) }
    })()
  }, [id, toast])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  if (notFound) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <FileX className="h-12 w-12 text-muted-foreground/50" />
      <p className="text-lg text-muted-foreground">ДИ не найдена</p>
      <Button onClick={() => router.push('/')}>На главную</Button>
    </div>
  )
  if (!di) return null

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-6xl mx-auto">
      <DIDetail
        di={di}
        onBack={() => router.push('/')}
        onEdit={() => router.push('/')}
        onDelete={() => router.push('/')}
        onCompare={() => router.push('/')}
        onRefresh={() => { (async () => { const res = await fetch(`/api/generate-di/${id}`); if (res.ok) setDi(await res.json()) })() }}
      />
    </div>
  )
}
