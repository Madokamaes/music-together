import { Router, type Router as RouterType, type Request, type Response } from 'express'
import { passwordLoginSchema } from '@music-together/shared'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { issueIdentityCookie } from '../services/identityService.js'
import { userRepo } from '../repositories/userRepository.js'
import { verifyPassword } from '../services/passwordService.js'
import { logger } from '../utils/logger.js'

const router: RouterType = Router()

const passwordLoginLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
})

/**
 * Ensure identity cookie exists, and renew expiry on every call.
 * Returns 204 and exposes identity metadata via headers.
 */
router.post('/identity/bootstrap', (req: Request, res: Response) => {
  const hasExistingIdentity = typeof req.identityUserId === 'string' && req.identityUserId.length > 0
  const issued = issueIdentityCookie(req, res, req.identityUserId)
  req.identityUserId = issued.userId
  userRepo.ensureUser(issued.userId)
  res.setHeader('Access-Control-Expose-Headers', 'X-Identity-UserId, X-Identity-Expires-At')
  res.setHeader('X-Identity-UserId', issued.userId)
  res.setHeader('X-Identity-Expires-At', String(issued.expiresAt))
  logger.info('Identity bootstrap issued', {
    userId: issued.userId,
    reusedIdentity: hasExistingIdentity,
    expiresAt: issued.expiresAt,
    ip: req.ip,
  })
  res.status(204).send()
})

router.post('/password/login', async (req: Request, res: Response) => {
  const parsed = passwordLoginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? '输入格式错误' })
    return
  }

  const accountId = parsed.data.accountId.trim()
  const key = `${req.ip ?? 'unknown'}:${accountId}`
  try {
    await passwordLoginLimiter.consume(key)
  } catch {
    res.status(429).json({ error: '尝试过于频繁，请稍后再试' })
    return
  }

  const record = userRepo.getPasswordRecord(accountId)
  if (!record || !(await verifyPassword(parsed.data.password, record))) {
    res.status(401).json({ error: '账号 ID 或密码不正确' })
    return
  }

  const issued = issueIdentityCookie(req, res, accountId)
  req.identityUserId = issued.userId
  const profile = userRepo.ensureUser(issued.userId)
  res.setHeader('Access-Control-Expose-Headers', 'X-Identity-UserId, X-Identity-Expires-At')
  res.setHeader('X-Identity-UserId', issued.userId)
  res.setHeader('X-Identity-Expires-At', String(issued.expiresAt))
  logger.info('Password login succeeded', { userId: issued.userId, ip: req.ip })
  res.json(profile)
})

export default router
