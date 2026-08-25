import { AsyncLocalStorage } from 'async_hooks'

/** AsyncLocalStorage для передачи requestId / userId через async call stack. */
export const requestContext = new AsyncLocalStorage<{
  requestId: string
  userId?: string
  path?: string
}>()

export function getRequestContext() {
  return requestContext.getStore()
}
