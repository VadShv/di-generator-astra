'use client'

// Страница входа (Фаза 5: Auth & production prep).
// Split-screen дизайн: слева — бренд-картинка, справа — форма входа.
// Адаптивная: на мобильных — стек, картинка сверху.

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Mail, Lock, ShieldCheck, Sparkles, FileText, ArrowRight } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
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
        {/* Фоновая картинка */}
        <Image
          src="/images/login-hero.png"
          alt="Генератор ДИ — Группа Астра"
          fill
          className="object-cover"
          priority
        />
        {/* Градиентный overlay для читаемости текста */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-violet-900/60" />

        {/* Верхний брендинг */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Генератор ДИ</h2>
              <p className="text-xs text-white/60">Группа Астра</p>
            </div>
          </div>
        </div>

        {/* Центральный слоган */}
        <div className="relative z-10 px-10">
          <h1 className="text-3xl font-bold text-white mb-3 leading-snug">
            Создавайте должностные<br />инструкции с ИИ
          </h1>
          <p className="text-sm text-white/70 max-w-sm leading-relaxed">
            Автоматическая генерация, согласование и архивирование ДИ
            для всей группы компаний — в единой системе.
          </p>

          {/* Feature badges */}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { icon: <Sparkles className="h-3 w-3" />, label: 'AI-генерация' },
              { icon: <ShieldCheck className="h-3 w-3" />, label: 'Соответствие ТК РФ' },
              { icon: <FileText className="h-3 w-3" />, label: 'Экспорт DOCX / PDF' },
            ].map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-xs text-white/90"
              >
                {f.icon}
                {f.label}
              </span>
            ))}
          </div>
        </div>

        {/* Нижний колонтитул */}
        <div className="relative z-10 p-10">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Группа Астра. Корпоративная система управления ДИ.
          </p>
        </div>
      </div>

      {/* Правая панель — форма входа */}
      <div className="flex flex-col justify-center items-center px-6 py-12 lg:px-16 bg-background">
        {/* Мобильный хедер (только на sm и меньше) */}
        <div className="lg:hidden w-full max-w-sm mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
              <FileText className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Генератор ДИ</h2>
              <p className="text-xs text-muted-foreground">Группа Астра</p>
            </div>
          </div>
          <div className="relative h-40 w-full rounded-xl overflow-hidden">
            <Image
              src="/images/login-hero.png"
              alt="Генератор ДИ"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-2xl font-bold tracking-tight">Вход в систему</h3>
            <p className="text-sm text-muted-foreground">
              Введите учётные данные для доступа к генератору ДИ
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@astra.ru"
                  required
                  autoFocus
                  className="pl-10 h-11"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Пароль
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-10 h-11"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={setRememberMe}
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  Запомнить меня
                </Label>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-violet-600 hover:bg-violet-700 transition-colors"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Вход...
                </>
              ) : (
                <>
                  Войти
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              При возникновении проблем со входом обратитесь<br />
              в службу поддержки ИТ-отдела Группы Астра
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
