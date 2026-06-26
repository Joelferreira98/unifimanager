import { Router } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middlewares/auth'
import { companyAccessError } from '../lib/companyAccess'

export const plansRoutes = Router()

plansRoutes.use(authenticate)

const planSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  // 0 é permitido: planos de cortesia geram venda com valor zero
  price: z.number().min(0),
  timeLimitMinutes: z.number().int().positive(),
  dataUsageLimitMBytes: z.number().int().positive().optional(),
  rxRateLimitKbps: z.number().int().min(2).max(100000).optional(),
  txRateLimitKbps: z.number().int().min(2).max(100000).optional(),
})

plansRoutes.post('/', authorize(Role.MASTER, Role.MANAGER), async (req, res) => {
  const data = planSchema.parse(req.body)

  const accessErr = await companyAccessError(req.user, data.companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const plan = await prisma.plan.create({ data })
  res.status(201).json(plan)
})

plansRoutes.get('/company/:companyId', async (req, res) => {
  const accessErr = await companyAccessError(req.user, req.params.companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const plans = await prisma.plan.findMany({
    where: { companyId: req.params.companyId, active: true },
    orderBy: { name: 'asc' },
  })
  res.json(plans)
})

plansRoutes.patch('/:id', authorize(Role.MASTER, Role.MANAGER), async (req, res) => {
  const data = planSchema.partial().parse(req.body)

  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: req.params.id } })
  // valida o vínculo com a empresa atual do plano e, se estiver sendo movido, com a nova
  const accessErr =
    (await companyAccessError(req.user, plan.companyId)) ??
    (data.companyId && data.companyId !== plan.companyId
      ? await companyAccessError(req.user, data.companyId)
      : null)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const updated = await prisma.plan.update({ where: { id: req.params.id }, data })
  res.json(updated)
})

plansRoutes.delete('/:id', authorize(Role.MASTER, Role.MANAGER), async (req, res) => {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: req.params.id } })
  const accessErr = await companyAccessError(req.user, plan.companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  await prisma.plan.update({ where: { id: req.params.id }, data: { active: false } })
  res.status(204).send()
})
