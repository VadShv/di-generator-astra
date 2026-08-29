'use client'

// Страница входа. Вынесли useSearchParams в отдельный компонент с Suspense
// для избежания BAILOUT_TO_CLIENT_SIDE_RENDERING в Next.js 15+.

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react'

function SearchParamsReader({ children }: { children: (callbackUrl: string) => React.ReactNode }) {
  const searchParams = useSearchParams()
  // Open redirect-защита: допускаем только относительные пути того же origin.
  // Блокируем абсолютные URL (https://evil.com) и протокольные редиректы (//evil.com).
  const rawCallbackUrl = searchParams.get('callbackUrl') || '/'
  const callbackUrl =
    rawCallbackUrl.startsWith('/') && !rawCallbackUrl.startsWith('//')
      ? rawCallbackUrl
      : '/'
  return <>{children(callbackUrl)}</>
}

function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (res?.error) {
        setError('Неверный email или пароль')
      } else if (res?.ok) {
        router.push(callbackUrl)
        router.refresh()
      } else {
        setError('Не удалось войти. Проверьте настройки аутентификации.')
      }
    } catch {
      setError('Сетевая ошибка при входе')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">
      {/* Левая панель — картинка + брендинг */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden">
        <img
          src="/images/login-hero.png"
          alt="Генератор ДИ — Группа Астра"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-violet-900/60" />

        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Генератор ДИ</h2>
              <p className="text-xs text-white/60">Группа Астра</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-10">
          <h1 className="text-3xl font-bold text-white mb-3 leading-snug">
            Создавайте должностные<br />инструкции с ИИ
          </h1>
          <p className="text-sm text-white/70 max-w-sm leading-relaxed">
            Автоматическая генерация, согласование и архивирование ДИ
            для всей группы компаний — в единой системе.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {['AI-генерация', 'Соответствие ТК РФ', 'Экспорт DOCX / PDF'].map((label, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-xs text-white/90">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 p-10">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Группа Астра. Корпоративная система управления ДИ.
          </p>
        </div>
      </div>

      {/* Правая панель — форма входа */}
      <div className="flex flex-col justify-center items-center px-6 py-12 lg:px-16 bg-background">
        <div className="lg:hidden w-full max-w-sm mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Генератор ДИ</h2>
              <p className="text-xs text-muted-foreground">Группа Астра</p>
            </div>
          </div>
          <div className="relative h-40 w-full rounded-xl overflow-hidden">
            <img src="/images/login-hero.png" alt="Генератор ДИ" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-2xl font-bold tracking-tight">Вход в систему</h3>
            <p className="text-sm text-muted-foreground">Введите учётные данные для доступа к генератору ДИ</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@astra.ru" required autoFocus className="pl-10 h-11" autoComplete="email" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Пароль</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="pl-10 h-11" autoComplete="current-password" />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>
            )}

            <Button type="submit" className="w-full h-11 bg-violet-600 hover:bg-violet-700" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Вход...</> : <>Войти<ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              При возникновении проблем со входом обратитесь<br />в службу поддержки ИТ-отдела Группы Астра
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    }>
      <SearchParamsReader>
        {(callbackUrl) => <LoginForm callbackUrl={callbackUrl} />}
      </SearchParamsReader>
    </Suspense>
  )
}
