import { Router } from 'express'
import { z } from 'zod'
import { VoucherStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middlewares/auth'
import { companyAccessError } from '../lib/companyAccess'
import { localDay } from '../services/ReportService'

export const dashboardRoutes = Router()

dashboardRoutes.use(authenticate)

const rangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
})

/**
 * Resumo do dashboard de uma empresa para o período (mês) informado, calculado no
 * banco — evita o limite de 500 vouchers da listagem, que tornava meses antigos
 * incompletos. Vouchers do mês e receita são do período; pendentes/ativos são
 * sempre ao vivo (status atual de todos os vouchers da empresa).
 */
dashboardRoutes.get('/company/:companyId', async (req, res) => {
  const accessErr = await companyAccessError(req.user, req.params.companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const { from, to } = rangeSchema.parse(req.query)
  const companyId = req.params.companyId

  const [total, pending, active, sales] = await Promise.all([
    prisma.voucher.count({ where: { companyId, generatedAt: { gte: from, lte: to } } }),
    prisma.voucher.count({ where: { companyId, status: VoucherStatus.PENDING } }),
    prisma.voucher.count({ where: { companyId, status: VoucherStatus.ACTIVE } }),
    prisma.sale.findMany({
      where: { trip: { companyId }, registeredAt: { gte: from, lte: to } },
      select: { amount: true, registeredAt: true },
    }),
  ])

  const dayMap = new Map<string, number>()
  let revenue = 0
  for (const s of sales) {
    const amount = Number(s.amount)
    revenue += amount
    const day = localDay(s.registeredAt)
    dayMap.set(day, (dayMap.get(day) ?? 0) + amount)
  }

  const round2 = (n: number) => Math.round(n * 100) / 100
  res.json({
    total,
    revenue: round2(revenue),
    pending,
    active,
    byDay: [...dayMap.entries()]
      .map(([date, value]) => ({ date, revenue: round2(value) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  })
})
