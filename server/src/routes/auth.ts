import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

export const authRoutes = Router()

// Freia tentativas de força bruta: até 10 logins por IP a cada 15 min.
// Respostas bem-sucedidas não contam, para não punir o uso normal.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

authRoutes.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)

  const user = await prisma.user.findUnique({ where: { email, active: true } })
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ message: 'Credenciais inválidas' })
    return
  }

  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as SignOptions['expiresIn'] }
  const token = jwt.sign(
    { userId: user.id, role: user.role, companyId: user.companyId },
    process.env.JWT_SECRET!,
    options
  )

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      canViewGlobalReports: user.canViewGlobalReports,
    },
  })
})
