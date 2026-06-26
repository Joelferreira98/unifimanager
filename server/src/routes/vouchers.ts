import { Router } from 'express'
import { z } from 'zod'
import { Prisma, Role, VoucherStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middlewares/auth'
import { companyAccessError } from '../lib/companyAccess'
import { unifiService } from '../services/UnifiService'

export const vouchersRoutes = Router()

vouchersRoutes.use(authenticate)

const generateSchema = z.object({
  planId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100).default(1),
})

vouchersRoutes.post('/generate', authorize(Role.MASTER, Role.MANAGER, Role.SELLER), async (req, res) => {
  const { planId, quantity } = generateSchema.parse(req.body)

  const plan = await prisma.plan.findUniqueOrThrow({
    where: { id: planId, active: true },
    include: { company: true },
  })

  // Verifica acesso à empresa
  const accessErr = await companyAccessError(req.user, plan.companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const trip = await prisma.trip.findFirstOrThrow({
    where: { companyId: plan.companyId, active: true },
    orderBy: { openedAt: 'desc' },
  })

  const unifiVouchers = await unifiService.createVouchers(plan.company.unifiSiteId, {
    name: plan.name,
    count: quantity,
    timeLimitMinutes: plan.timeLimitMinutes,
    dataUsageLimitMBytes: plan.dataUsageLimitMBytes ?? undefined,
    rxRateLimitKbps: plan.rxRateLimitKbps ?? undefined,
    txRateLimitKbps: plan.txRateLimitKbps ?? undefined,
  })

  const created = []

  for (const unifiVoucher of unifiVouchers) {
    const voucher = await prisma.voucher.create({
      data: {
        unifiVoucherId: unifiVoucher.id,
        code: String(unifiVoucher.code),
        planId: plan.id,
        companyId: plan.companyId,
        createdById: req.user.userId,
        tripId: trip.id,
      },
    })

    created.push({
      ...voucher,
      code: unifiVoucher.code,
      // inclui o plano para o front (impressão usa plan.name/price/timeLimitMinutes)
      plan: { name: plan.name, price: plan.price, timeLimitMinutes: plan.timeLimitMinutes },
    })
  }

  res.status(201).json(created)
})

/**
 * Lista vouchers que existem na controladora UniFi mas ainda não estão no nosso banco.
 * Sugere o plano cujo nome bate (case-insensitive) com o nome do voucher.
 */
vouchersRoutes.get('/importable', authorize(Role.MASTER, Role.MANAGER, Role.SELLER), async (req, res) => {
  const companyId = z.string().uuid().parse(req.query.companyId)

  const accessErr = await companyAccessError(req.user, companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } })

  const [unifiVouchers, existing, plans] = await Promise.all([
    unifiService.getVouchers(company.unifiSiteId),
    prisma.voucher.findMany({
      where: { companyId, unifiVoucherId: { not: null } },
      select: { unifiVoucherId: true },
    }),
    prisma.plan.findMany({ where: { companyId, active: true }, select: { id: true, name: true } }),
  ])

  const existingIds = new Set(existing.map((v) => v.unifiVoucherId))
  const planByName = new Map(plans.map((p) => [p.name.trim().toLowerCase(), p.id]))

  const importable = unifiVouchers
    .filter((v) => !existingIds.has(v.id))
    .map((v) => ({
      unifiVoucherId: v.id,
      code: v.code,
      name: v.name,
      timeLimitMinutes: v.timeLimitMinutes,
      expired: v.expired,
      activatedAt: v.activatedAt ?? null,
      // vendido = alguém usou (authorizedGuestCount > 0)
      used: (v.authorizedGuestCount ?? 0) > 0 || !!v.activatedAt,
      suggestedPlanId: planByName.get((v.name ?? '').trim().toLowerCase()) ?? null,
    }))

  res.json(importable)
})

const importSchema = z.object({
  companyId: z.string().uuid(),
  items: z
    .array(z.object({ unifiVoucherId: z.string().min(1), planId: z.string().uuid() }))
    .min(1),
})

/**
 * Importa vouchers criados direto na controladora, associando cada um a um plano.
 * São criados como PENDING; o job de sync cuida de ativação/expiração/remoção depois.
 */
vouchersRoutes.post('/import', authorize(Role.MASTER, Role.MANAGER, Role.SELLER), async (req, res) => {
  const { companyId, items } = importSchema.parse(req.body)

  const accessErr = await companyAccessError(req.user, companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
  const trip = await prisma.trip.findFirstOrThrow({
    where: { companyId, active: true },
    orderBy: { openedAt: 'desc' },
  })

  // Planos válidos da empresa + estado atual no UniFi (code autoritativo) + já existentes
  const [plans, unifiVouchers, existing] = await Promise.all([
    prisma.plan.findMany({ where: { companyId, active: true } }),
    unifiService.getVouchers(company.unifiSiteId),
    prisma.voucher.findMany({
      where: { companyId, unifiVoucherId: { in: items.map((i) => i.unifiVoucherId) } },
      select: { unifiVoucherId: true },
    }),
  ])

  const planById = new Map(plans.map((p) => [p.id, p]))
  const unifiById = new Map(unifiVouchers.map((v) => [v.id, v]))
  const existingIds = new Set(existing.map((v) => v.unifiVoucherId))

  let imported = 0
  let withSale = 0
  const skipped: string[] = []

  for (const item of items) {
    const plan = planById.get(item.planId)
    const uv = unifiById.get(item.unifiVoucherId)
    // pula: plano inválido, voucher inexistente no UniFi, ou já importado
    if (!plan || !uv || existingIds.has(item.unifiVoucherId)) {
      skipped.push(item.unifiVoucherId)
      continue
    }

    // Estado autoritativo do UniFi no momento da importação.
    // "Vendido" = authorizedGuestCount > 0 (alguém usou). Se já foi usado,
    // registra a venda na hora — o UniFi pode perder o dado antes do próximo sync.
    const wasUsed = (uv.authorizedGuestCount ?? 0) > 0 || !!uv.activatedAt
    const usedAt = uv.activatedAt ? new Date(uv.activatedAt) : new Date()
    const status: VoucherStatus = wasUsed
      ? uv.expired
        ? VoucherStatus.EXPIRED
        : VoucherStatus.ACTIVE
      : uv.expired
        ? VoucherStatus.EXPIRED
        : VoucherStatus.PENDING

    await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          unifiVoucherId: uv.id,
          code: String(uv.code),
          planId: plan.id,
          companyId,
          createdById: req.user.userId,
          tripId: trip.id,
          status,
          activatedAt: wasUsed ? usedAt : null,
          expiresAt: uv.expiresAt ? new Date(uv.expiresAt) : null,
        },
      })

      if (wasUsed) {
        await tx.sale.create({
          data: {
            voucherId: voucher.id,
            tripId: trip.id,
            sellerId: req.user.userId,
            amount: plan.price,
            registeredAt: usedAt,
          },
        })
        withSale++
      }
    })
    imported++
  }

  res.status(201).json({ imported, withSale, skipped: skipped.length })
})

vouchersRoutes.get('/', authorize(Role.MASTER, Role.MANAGER, Role.SELLER), async (req, res) => {
  const { tripId, status, companyId, planId } = req.query

  // Escopo de empresa por papel — nenhum usuário pode listar vouchers de empresas
  // fora do seu alcance. SELLER: a própria empresa. MANAGER: apenas as que gerencia.
  // MASTER: todas (ou a empresa pedida).
  let companyScope: Prisma.VoucherWhereInput
  if (req.user.role === Role.SELLER) {
    companyScope = { companyId: req.user.companyId }
  } else if (req.user.role === Role.MANAGER) {
    const managed = await prisma.managerCompany.findMany({
      where: { managerId: req.user.userId },
      select: { companyId: true },
    })
    const managedIds = managed.map((m) => m.companyId)
    if (companyId) {
      if (!managedIds.includes(String(companyId))) {
        res.status(403).json({ message: 'Você não gerencia essa empresa' })
        return
      }
      companyScope = { companyId: String(companyId) }
    } else {
      companyScope = { companyId: { in: managedIds } }
    }
  } else {
    companyScope = companyId ? { companyId: String(companyId) } : {}
  }

  // Valida o status contra o enum para não vazar erro do Prisma (status inválido → ignora).
  const statusFilter =
    status && (Object.values(VoucherStatus) as string[]).includes(String(status))
      ? { status: status as VoucherStatus }
      : {}

  const vouchers = await prisma.voucher.findMany({
    where: {
      ...(tripId ? { tripId: String(tripId) } : {}),
      ...statusFilter,
      ...(planId ? { planId: String(planId) } : {}),
      ...companyScope,
    },
    include: {
      plan: { select: { name: true, price: true, timeLimitMinutes: true } },
      createdBy: { select: { name: true } },
      sale: { select: { amount: true, registeredAt: true } },
    },
    orderBy: { generatedAt: 'desc' },
    take: 500,
  })

  res.json(vouchers)
})

vouchersRoutes.delete('/:id', authorize(Role.MANAGER, Role.MASTER), async (req, res) => {
  const voucher = await prisma.voucher.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { trip: { include: { company: true } } },
  })

  const accessErr = await companyAccessError(req.user, voucher.companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  if (voucher.unifiVoucherId) {
    await unifiService.deleteVoucher(voucher.trip.company.unifiSiteId, voucher.unifiVoucherId)
  }

  await prisma.voucher.update({
    where: { id: req.params.id },
    data: { status: 'CANCELLED' },
  })

  res.status(204).send()
})
