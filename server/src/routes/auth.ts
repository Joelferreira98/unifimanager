import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

export const authRoutes = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

authRoutes.post('/login', async (req, res) => {
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
