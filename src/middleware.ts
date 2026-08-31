// Edge-совместимый middleware (Фаза 5: Auth & production prep).
// Гейтит доступ к приложению и API при включённой аутентификации.
//
// Логика:
//   - Если AUTH_SECRET не задан — аутентификация отключена, пропускаем всё.
//   - Публичные пути: /login, /api/auth/*, статика Next.js (_next, favicon, иконки).
//   - Иначе: проверяем и валидируем JWT session-token через getToken (jose, Edge-safe).
//     Если токен отсутствует или невалиден — редирект на /login (страницы) или 401 (API).
//
// Middleware работает в Edge runtime, поэтому НЕ импортирует Prisma/next-auth
// (они требуют Node runtime). Валидация JWT выполняется здесь через getToken
// (next-auth/jwt, на базе jose — Edge-совместимо). Дополнительная проверка
// авторизации (роль/права) — в API-роутах через getServerSession.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_PAGES = ['/login']
const PUBLIC_API_PREFIXES = ['/api/auth']

function isAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
}

const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

/**
 * Проверка CSRF для мутаций на /api/.
 * Fail-closed: запрос без sec-fetch-site (не-браузер) должен предъявить
 * валидный Origin, совпадающий с Host. Иначе — блокировка.
 *
 * Возвращает true, если запрос разрешён CSRF-проверкой; false — если заблокирован.
 * Чистая функция для удобного тестирования.
 */
export function isCsrfAllowed(
  method: string,
  pathname: string,
  fetchSite: string | null,
  origin: string | null,
  host: string | null
): boolean {
  // CSRF-проверка только для мутаций на /api/.
  if (!pathname.startsWith('/api/')) return true
  if (!MUTATION_METHODS.includes(method)) return true

  // Браузер передал sec-fetch-site: доверяем ему.
  if (fetchSite) {
    return fetchSite === 'same-origin' || fetchSite === 'none'
  }

  // sec-fetch-site отсутствует (не-браузер / curl): fail-closed —
  // требуем валидный Origin, совпадающий с Host.
  if (!origin || !host) return false

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }
  return originHost === host
}

/**
 * Валидация JWT session-token через getToken (jose, Edge-совместимо).
 * В отличие от проверки наличия cookie, проверяет подпись и срок токена.
 */
async function getValidSessionToken(request: NextRequest): Promise<boolean> {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    })
    return Boolean(token)
  } catch {
    // Ошибка верификации (невалидная подпись, истёкший токен) — считаем не залогиненным.
    return false
  }
}

export async function middleware(request: NextRequest) {
  // Аутентификация не настроена — пропускаем всё.
  if (!isAuthConfigured()) return NextResponse.next()

  const { pathname } = request.nextUrl

  // Публичные API (auth-эндпоинты next-auth).
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()

  // Liveness-проверка /api/health — публичная (для k8s liveness probe и Caddy).
  // readiness /api/health/ready — остаётся за auth (раскрывает детали БД/памяти).
  if (pathname === '/api/health') return NextResponse.next()

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
  // Fail-closed: мутация без sec-fetch-site и без валидного Origin блокируется.
  if (
    !isCsrfAllowed(
      request.method,
      pathname,
      request.headers.get('sec-fetch-site'),
      request.headers.get('origin'),
      request.headers.get('host')
    )
  ) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 })
  }

  // Залогинен? (валидация JWT, не только наличие cookie)
  if (await getValidSessionToken(request)) return NextResponse.next()

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
