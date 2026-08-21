// Next-auth route handler (App Router, next-auth v4).
// Экспортируем GET и POST — next-auth обрабатывает всё остальное.
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
