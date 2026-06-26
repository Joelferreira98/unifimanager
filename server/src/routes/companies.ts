import { Router } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middlewares/auth'
import { companyAccessError } from '../lib/companyAccess'

export const companiesRoutes = Router()

companiesRoutes.use(authenticate)

const companySchema = z.object({
  name: z.string().min(1),
  unifiSiteId: z.string().uuid(),
})

const companyUpdateSchema = companySchema.partial()

companiesRoutes.post('/', authorize(Role.MASTER), async (req, res) => {
  const data = companySchema.parse(req.body)
  const company = await prisma.$transaction(async (tx) => {
    const c = await tx.company.create({ data })
    await tx.trip.create({ data: { companyId: c.id } })
    return c
  })
  res.status(201).json(company)
})

companiesRoutes.patch('/:id', authorize(Role.MASTER), async (req, res) => {
  const data = companyUpdateSchema.parse(req.body)
  const company = await prisma.company.update({
    where: { id: req.params.id },
    data,
  })
  res.json(company)
})

// Exclusão lógica: a empresa tem viagens, vendas, vouchers e vendedores
// vinculados, então marcamos active=false (a listagem já filtra por active).
companiesRoutes.delete('/:id', authorize(Role.MASTER), async (req, res) => {
  await prisma.company.update({
    where: { id: req.params.id },
    data: { active: false },
  })
  res.status(204).send()
})

companiesRoutes.post('/:id/managers/:managerId', authorize(Role.MASTER), async (req, res) => {
  await prisma.managerCompany.create({
    data: { companyId: req.params.id, managerId: req.params.managerId },
  })
  res.status(201).send()
})

companiesRoutes.delete('/:id/managers/:managerId', authorize(Role.MASTER), async (req, res) => {
  await prisma.managerCompany.delete({
    where: { managerId_companyId: { managerId: req.params.managerId, companyId: req.params.id } },
  })
  res.status(204).send()
})

// SELLER também lista, mas só enxerga a própria empresa (o front usa para exibir o nome)
companiesRoutes.get('/', authorize(Role.MASTER, Role.MANAGER, Role.SELLER), async (req, res) => {
  if (req.user.role === Role.SELLER && !req.user.companyId) {
    res.json([])
    return
  }

  const where =
    req.user.role === Role.MASTER
      ? { active: true }
      : req.user.role === Role.MANAGER
        ? { active: true, managers: { some: { managerId: req.user.userId } } }
        : { active: true, id: req.user.companyId }

  const companies = await prisma.company.findMany({
    where,
    include: {
      plans: { where: { active: true }, select: { id: true } },
      managers: { include: { manager: { select: { id: true, name: true, email: true } } } },
      _count: { select: { sellers: { where: { active: true } } } },
    },
    orderBy: { name: 'asc' },
  })
  res.json(companies)
})

companiesRoutes.get('/:id', authorize(Role.MASTER, Role.MANAGER), async (req, res) => {
  const accessErr = await companyAccessError(req.user, req.params.id)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      plans: { where: { active: true } },
      managers: { include: { manager: { select: { id: true, name: true, email: true } } } },
      sellers: { where: { active: true }, select: { id: true, name: true, email: true } },
      trips: { where: { active: true }, take: 1, orderBy: { openedAt: 'desc' } },
    },
  })
  res.json(company)
})
