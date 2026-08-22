// Edge-совместимый middleware (Фаза 5: Auth & production prep).
// Гейтит доступ к приложению и API при включённой аутентификации.
//
// Логика:
//   - Если AUTH_SECRET не задан — аутентификация отключена, пропускаем всё.
//   - Публичные пути: /login, /api/auth/*, статика Next.js (_next, favicon, иконки).
//   - Иначе: проверяем наличие next-auth session-token (cookie).
//     Если его нет — редирект на /login (для страниц) или 401 (для API).
//
// Middleware работает в Edge runtime, поэтому НЕ импортирует Prisma/next-auth
// (они требуют Node runtime). Проверяем только наличие cookie с токеном —
// валидация самого JWT выполняется в API-роутах через getServerSession.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PAGES = ['/login']
const PUBLIC_API_PREFIXES = ['/api/auth']

function isAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
}

function hasSessionToken(request: NextRequest): boolean {
  // next-auth v4 использует secure-cookie в проде и обычный в dev.
  return Boolean(
    request.cookies.get('next-auth.session-token')?.value ||
      request.cookies.get('__Secure-next-auth.session-token')?.value
  )
}

export function middleware(request: NextRequest) {
  // Аутентификация не настроена — пропускаем всё.
  if (!isAuthConfigured()) return NextResponse.next()

  const { pathname } = request.nextUrl

  // Публичные API (auth-эндпоинты next-auth).
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()

  // Публичные страницы (login).
  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Статика Next.js и публичные ассеты.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/)
  ) {
    return NextResponse.next()
  }

  // CSRF-защита: блокируем cross-origin мутации (POST/PUT/PATCH/DELETE).
  const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
  if (pathname.startsWith('/api/') && MUTATION_METHODS.includes(request.method)) {
    const fetchSite = request.headers.get('sec-fetch-site')
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 })
    }
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')
    if (origin && host) {
      let originHost: string
      try {
        originHost = new URL(origin).host
      } catch {
        return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
      }
      if (originHost !== host) {
        return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
      }
    }
  }

  // Залогинен?
  if (hasSessionToken(request)) return NextResponse.next()

  // Не залогинен — API возвращает 401, страницы редиректят на /login.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Требуется аутентификация' }, { status: 401 })
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('callbackUrl', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Применяем ко всем маршрутам, кроме статики.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
