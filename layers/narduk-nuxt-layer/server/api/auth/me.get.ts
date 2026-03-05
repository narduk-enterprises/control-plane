import { getSessionUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)

  if (!user) {
    return { user: null }
  }

  const { passwordHash: _passwordHash, ...cleanUser } = user

  return { user: cleanUser }
})
