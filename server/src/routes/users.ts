import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middlewares/auth'
import { companyAccessError } from '../lib/companyAccess'

export const usersRoutes = Router()

usersRoutes.use(authenticate)

const createManagerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
})

const createSellerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  companyId: z.string().uuid(),
})

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

// --- Perfil do próprio usuário (qualquer papel) ---

usersRoutes.get('/me', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user.userId },
    select: { id: true, name: true, email: true, role: true, companyId: true, canViewGlobalReports: true, createdAt: true },
  })
  res.json(user)
})

usersRoutes.patch('/me', async (req, res) => {
  const data = updateProfileSchema.parse(req.body)

  if (data.email) {
    const exists = await prisma.user.findFirst({
      where: { email: data.email, id: { not: req.user.userId } },
      select: { id: true },
    })
    if (exists) {
      res.status(409).json({ message: 'E-mail já está em uso' })
      return
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user.userId },
    data,
    select: { id: true, name: true, email: true, role: true, companyId: true },
  })
  res.json(user)
})

usersRoutes.patch('/me/password', async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body)

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.userId } })
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    res.status(400).json({ message: 'Senha atual incorreta' })
    return
  }

  await prisma.user.update({
    where: { id: req.user.userId },
    data: { password: await bcrypt.hash(newPassword, 10) },
  })
  res.status(204).send()
})

/**
 * Se o e-mail pertence a um usuário DESATIVADO, reativa-o com os novos dados
 * (o e-mail é único, então a recriação falharia). Usuário ativo → 409.
 * Retorna o usuário reativado, ou null se o e-mail está livre.
 */
async function reactivateIfDeactivated(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  email: string,
  data: { name: string; password: string; role: Role; companyId: string | null; createdById: string }
) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (!existing) return null
  if (existing.active) {
    res.status(409).json({ message: 'E-mail já está em uso' })
    return 'conflict' as const
  }
  return prisma.user.update({
    where: { id: existing.id },
    data: { ...data, active: true },
    select: { id: true, name: true, email: true, role: true, companyId: true, createdAt: true },
  })
}

// MASTER: cria gerente
usersRoutes.post('/managers', authorize(Role.MASTER), async (req, res) => {
  const data = createManagerSchema.parse(req.body)
  const password = await bcrypt.hash(data.password, 10)

  const reactivated = await reactivateIfDeactivated(res, data.email, {
    name: data.name,
    password,
    role: Role.MANAGER,
    companyId: null,
    createdById: req.user.userId,
  })
  if (reactivated === 'conflict') return
  if (reactivated) {
    res.status(201).json(reactivated)
    return
  }

  const user = await prisma.user.create({
    data: {
      ...data,
      password,
      role: Role.MANAGER,
      createdById: req.user.userId,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
  res.status(201).json(user)
})

// MANAGER: cria vendedor vinculado a uma empresa que gerencia
usersRoutes.post('/sellers', authorize(Role.MANAGER), async (req, res) => {
  const data = createSellerSchema.parse(req.body)

  const accessErr = await companyAccessError(req.user, data.companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const password = await bcrypt.hash(data.password, 10)

  const reactivated = await reactivateIfDeactivated(res, data.email, {
    name: data.name,
    password,
    role: Role.SELLER,
    companyId: data.companyId,
    createdById: req.user.userId,
  })
  if (reactivated === 'conflict') return
  if (reactivated) {
    res.status(201).json(reactivated)
    return
  }

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password,
      role: Role.SELLER,
      companyId: data.companyId,
      createdById: req.user.userId,
    },
    select: { id: true, name: true, email: true, role: true, companyId: true, createdAt: true },
  })
  res.status(201).json(user)
})

// Lista usuários criados pelo requester
usersRoutes.get('/', authorize(Role.MASTER, Role.MANAGER), async (req, res) => {
  const users = await prisma.user.findMany({
    where: { createdById: req.user.userId, active: true },
    select: { id: true, name: true, email: true, role: true, companyId: true, canViewGlobalReports: true, createdAt: true },
    orderBy: { name: 'asc' },
  })
  res.json(users)
})

// MASTER: concede/revoga acesso ao relatório geral da frota para um usuário que criou.
const globalAccessSchema = z.object({ canViewGlobalReports: z.boolean() })
usersRoutes.patch('/:id/global-reports', authorize(Role.MASTER), async (req, res) => {
  const { canViewGlobalReports } = globalAccessSchema.parse(req.body)
  await prisma.user.update({
    where: { id: req.params.id, createdById: req.user.userId },
    data: { canViewGlobalReports },
  })
  res.status(204).send()
})

usersRoutes.patch('/:id/deactivate', authorize(Role.MASTER, Role.MANAGER), async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.id, createdById: req.user.userId },
    data: { active: false },
  })
  res.status(204).send()
})
