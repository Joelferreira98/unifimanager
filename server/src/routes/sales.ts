import { Router } from 'express'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middlewares/auth'
import { companyAccessError } from '../lib/companyAccess'
import { unifiService } from '../services/UnifiService'

export const salesRoutes = Router()

salesRoutes.use(authenticate)

salesRoutes.get('/trip/:tripId', authorize(Role.MASTER, Role.MANAGER, Role.SELLER), async (req, res) => {
  // SELLER vê todas as vendas da viagem, mas apenas de viagens da própria empresa;
  // MANAGER, apenas de empresas que gerencia.
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: req.params.tripId },
    select: { companyId: true },
  })
  const accessErr = await companyAccessError(req.user, trip.companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const sales = await prisma.sale.findMany({
    where: { tripId: req.params.tripId },
    include: {
      voucher: { select: { code: true, plan: { select: { name: true, timeLimitMinutes: true } } } },
      seller: { select: { name: true } },
    },
    orderBy: { registeredAt: 'desc' },
  })

  const total = sales.reduce((sum: number, s) => sum + Number(s.amount), 0)
  res.json({ total, count: sales.length, sales })
})

// Remove uma venda do caixa: apaga a Sale (sai da receita da viagem), cancela o
// voucher e tenta excluí-lo no UniFi. Restrito ao MASTER.
// O voucher vira CANCELLED, então o job de sync (que só olha PENDING) não recria a venda.
salesRoutes.delete('/:id', authorize(Role.MASTER), async (req, res) => {
  const sale = await prisma.sale.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { voucher: true, trip: { include: { company: true } } },
  })

  // Tenta remover no controlador, mas não bloqueia se o voucher já não existir lá.
  if (sale.voucher.unifiVoucherId) {
    try {
      await unifiService.deleteVoucher(sale.trip.company.unifiSiteId, sale.voucher.unifiVoucherId)
    } catch (err) {
      console.error(`Falha ao excluir voucher ${sale.voucher.code} no UniFi:`, err)
    }
  }

  await prisma.$transaction([
    prisma.sale.delete({ where: { id: sale.id } }),
    prisma.voucher.update({ where: { id: sale.voucherId }, data: { status: 'CANCELLED' } }),
  ])

  res.status(204).send()
})

salesRoutes.get('/seller/:sellerId', authorize(Role.MASTER, Role.MANAGER), async (req, res) => {
  // MANAGER só consulta vendedores de empresas que gerencia
  if (req.user.role === Role.MANAGER) {
    const seller = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.sellerId },
      select: { companyId: true },
    })
    const accessErr = seller.companyId
      ? await companyAccessError(req.user, seller.companyId)
      : 'Você não gerencia essa empresa'
    if (accessErr) {
      res.status(403).json({ message: accessErr })
      return
    }
  }

  const sales = await prisma.sale.findMany({
    where: { sellerId: req.params.sellerId },
    include: {
      voucher: { select: { code: true, plan: { select: { name: true } } } },
    },
    orderBy: { registeredAt: 'desc' },
  })

  const total = sales.reduce((sum: number, s) => sum + Number(s.amount), 0)
  res.json({ total, count: sales.length, sales })
})
