import { Router } from 'express'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middlewares/auth'
import { companyAccessError } from '../lib/companyAccess'

export const tripsRoutes = Router()

tripsRoutes.use(authenticate)

// SELLER visualiza o caixa completo (há um vendedor por embarcação),
// mas apenas da própria empresa; fechar caixa é restrito a MASTER/MANAGER.

// Viagem ativa de uma empresa
tripsRoutes.get('/company/:companyId/active', async (req, res) => {
  const { companyId } = req.params
  const accessErr = await companyAccessError(req.user, companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const trip = await prisma.trip.findFirst({
    where: { companyId, active: true },
    include: {
      _count: { select: { vouchers: true, sales: true } },
      sales: { select: { amount: true } },
    },
    orderBy: { openedAt: 'desc' },
  })

  if (!trip) {
    res.status(404).json({ message: 'Nenhuma viagem ativa' })
    return
  }

  const totalRevenue = trip.sales.reduce((sum: number, s) => sum + Number(s.amount), 0)
  res.json({ ...trip, totalRevenue })
})

// Histórico de viagens de uma empresa
tripsRoutes.get('/company/:companyId', async (req, res) => {
  const { companyId } = req.params
  const accessErr = await companyAccessError(req.user, companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const trips = await prisma.trip.findMany({
    where: { companyId },
    include: {
      _count: { select: { vouchers: true, sales: true } },
      sales: { select: { amount: true } },
    },
    orderBy: { openedAt: 'desc' },
  })

  const result = trips.map((trip) => ({
    ...trip,
    totalRevenue: trip.sales.reduce((sum: number, s) => sum + Number(s.amount), 0),
  }))

  res.json(result)
})

// Fechar caixa: encerra viagem atual e abre nova automaticamente
tripsRoutes.post('/company/:companyId/close', authorize(Role.MASTER, Role.MANAGER), async (req, res) => {
  const companyId = req.params.companyId

  const accessErr = await companyAccessError(req.user, companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const closedTrip = await prisma.trip.findFirstOrThrow({
    where: { companyId, active: true },
    orderBy: { openedAt: 'desc' },
  })

  const [closed, newTrip] = await prisma.$transaction([
    prisma.trip.update({
      where: { id: closedTrip.id },
      data: { active: false, closedAt: new Date() },
    }),
    prisma.trip.create({ data: { companyId } }),
  ])

  res.json({ closed, newTrip })
})
