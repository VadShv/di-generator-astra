// Типизированный клиент API для фронтенда (Фаза 6: Frontend refactoring).
// Заменяет разрозненные вызовы fetch по всему UI единым типизированным интерфейсом.
//
// Возможности:
//   - Единая обработка ошибок (парсинг { error } из ответа, сетевые сбои)
//   - Типизация ответов через дженерики
//   - Поддержка GET / POST / PUT / DELETE / PATCH
//   - Авто-сериализация JSON и установка заголовков
//   - Тихий режим (silent) для фоновых загрузок, где ошибка некритична

/** Структура ошибки API. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

type FetchOptions = {
  /** Тело запроса (будет сериализовано в JSON). */
  body?: unknown
  /** Query-параметры. */
  query?: Record<string, string | number | boolean | string[] | undefined>
  /** Прерывать запрос через этот AbortSignal. */
  signal?: AbortSignal
  /** Тихий режим: не бросать ошибку, вернуть null. */
  silent?: boolean
  /** Кастомные заголовки. */
  headers?: Record<string, string>
  /** Скрыть автоматический Content-Type (например, для FormData). */
  rawBody?: boolean
}

function buildUrl(path: string, query?: FetchOptions['query']): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)))
    } else {
      params.append(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

async function request<T>(
  method: string,
  path: string,
  options: FetchOptions = {}
): Promise<T | null> {
  const { body, query, signal, silent, headers, rawBody } = options
  const url = buildUrl(path, query)

  const init: RequestInit = {
    method,
    signal,
    headers: rawBody ? headers : { 'Content-Type': 'application/json', ...headers },
  }

  if (body !== undefined) {
    init.body = rawBody ? (body as BodyInit) : JSON.stringify(body)
  }

  try {
    const res = await fetch(url, init)
    if (!res.ok) {
      // Пытаемся распарсить { error: string } из тела ошибки.
      let errBody: unknown
      try {
        errBody = await res.json()
      } catch {
        errBody = undefined
      }
      const message =
        (errBody && typeof errBody === 'object' && 'error' in errBody
          ? String((errBody as { error: unknown }).error)
          : null) || `HTTP ${res.status}`
      if (silent) return null
      throw new ApiClientError(message, res.status, errBody)
    }

    // 204 No Content или пустое тело.
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch (e) {
    if (silent) return null
    if (e instanceof ApiClientError) throw e
    // Сетевая ошибка.
    throw new ApiClientError(
      e instanceof Error ? `Сетевая ошибка: ${e.message}` : 'Неизвестная сетевая ошибка',
      0
    )
  }
}

/**
 * Единый типизированный API-клиент.
 * @example
 *   const companies = await api.get<Company[]>('/api/companies')
 *   await api.post('/api/companies', { body: { name: 'ООО Ромашка' } })
 */
export const api = {
  get: <T>(path: string, options?: FetchOptions) => request<T>('GET', path, options),
  post: <T>(path: string, options?: FetchOptions) => request<T>('POST', path, options),
  put: <T>(path: string, options?: FetchOptions) => request<T>('PUT', path, options),
  patch: <T>(path: string, options?: FetchOptions) => request<T>('PATCH', path, options),
  delete: <T>(path: string, options?: FetchOptions) => request<T>('DELETE', path, options),
}
