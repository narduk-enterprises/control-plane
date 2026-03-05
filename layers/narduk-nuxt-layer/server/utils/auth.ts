import type { H3Event } from 'h3'
import { getCookie, setCookie, deleteCookie, getRequestHeader } from 'h3'
import { eq, and, gt } from 'drizzle-orm'
import type { User } from '../database/schema'
import { sessions, users } from '../database/schema'

/**
 * Session & authentication utilities for D1-backed auth.
 *
 * Uses PBKDF2-hashed passwords (see ./password.ts) and D1 session storage.
 * Cookie name defaults to 'app_session' — override via runtimeConfig.sessionCookieName.
 */

const DEFAULT_SESSION_COOKIE = 'app_session'
const SESSION_DAYS = 30

function getSessionCookieName(event: H3Event): string {
  try {
    const config = useRuntimeConfig(event)
    return (config as Record<string, unknown>).sessionCookieName as string || DEFAULT_SESSION_COOKIE
  } catch {
    return DEFAULT_SESSION_COOKIE
  }
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Create a D1-backed session for a user and set the session cookie.
 */
export async function createSession(event: H3Event, userId: string): Promise<string> {
  const db = useDatabase(event)
  const id = crypto.randomUUID()
  const expiresAt = nowSec() + SESSION_DAYS * 86400

  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    createdAt: new Date().toISOString(),
  })

  const host = getRequestHeader(event, 'host') ?? ''
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const cookieName = getSessionCookieName(event)

  setCookie(event, cookieName, id, {
    httpOnly: true,
    secure: !isLocalhost,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 86400,
    path: '/',
  })

  return id
}

/**
 * Get the current user from the session cookie.
 * Returns null if the cookie is missing, session is expired, or the user doesn't exist.
 */
export async function getSessionUser(event: H3Event): Promise<User | null> {
  const cookieName = getSessionCookieName(event)
  const token = getCookie(event, cookieName)
  if (!token) return null

  const db = useDatabase(event)
  const now = nowSec()

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
      appleId: users.appleId,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, now)))
    .limit(1)

  return (rows[0] as User) ?? null
}

/**
 * Destroy the current session and clear the cookie.
 */
export async function destroySession(event: H3Event): Promise<void> {
  const cookieName = getSessionCookieName(event)
  const token = getCookie(event, cookieName)

  if (token) {
    const db = useDatabase(event)
    await db.delete(sessions).where(eq(sessions.id, token))
  }

  deleteCookie(event, cookieName, { path: '/' })
}

/**
 * Get the current user from the session. Throws 401 if not authenticated.
 */
export async function requireAuth(event: H3Event): Promise<User> {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }
  return user
}

/**
 * Require admin authentication. Throws 401 if not authenticated, 403 if not admin.
 */
export async function requireAdmin(event: H3Event): Promise<User> {
  const user = await requireAuth(event)
  if (!user.isAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Forbidden — admin access required',
    })
  }
  return user
}
