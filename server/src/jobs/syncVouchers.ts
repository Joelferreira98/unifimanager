import cron from 'node-cron'
import { Prisma, VoucherStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { unifiService } from '../services/UnifiService'

// Quantos ciclos consecutivos um voucher precisa sumir da listagem antes de ser
// excluído. Protege contra instabilidade do controlador (HA/cluster fora de
// sincronia), que faz o mesmo voucher alternar entre presente e ausente entre
// requisições.
const DELETE_AFTER_CONSECUTIVE_MISSES = 3
const missCounts = new Map<string, number>()

type PendingVoucher = Prisma.VoucherGetPayload<{
  include: { plan: true; trip: { include: { company: true } } }
}>

type UnifiVoucher = Awaited<ReturnType<typeof unifiService.getVouchers>>[number]

/**
 * Reconcilia um voucher PENDING contra o que veio da controladora:
 *  - ausente da listagem por N ciclos seguidos → exclui do nosso sistema
 *  - usado (authorizedGuestCount > 0 ou activatedAt) → ACTIVE/EXPIRED + registra a venda
 *  - expirado sem uso → EXPIRED, sem venda
 */
async function reconcileVoucher(
  voucher: PendingVoucher,
  unifiVoucher: UnifiVoucher | undefined,
): Promise<void> {
  if (!unifiVoucher) {
    // Sumiu da listagem. Pode ser remoção real OU instabilidade do controlador.
    // Só exclui depois de N ciclos consecutivos, para não apagar voucher válido.
    const misses = (missCounts.get(voucher.id) ?? 0) + 1
    missCounts.set(voucher.id, misses)
    if (misses >= DELETE_AFTER_CONSECUTIVE_MISSES) {
      // Voucher PENDING nunca tem Sale, então é seguro excluir.
      await prisma.voucher.delete({ where: { id: voucher.id } })
      missCounts.delete(voucher.id)
      console.log(`Voucher ${voucher.code} ausente da controladora por ${misses} ciclos — excluído`)
    }
    return
  }

  missCounts.delete(voucher.id) // apareceu na listagem → zera o contador de ausências

  // "Vendido" = alguém autorizou/usou o voucher → authorizedGuestCount > 0.
  // (activatedAt nem sempre vem preenchido, então não dá para confiar só nele.)
  // Um voucher usado pode já estar expirado — mesmo assim a venda precisa entrar.
  const wasUsed = (unifiVoucher.authorizedGuestCount ?? 0) > 0 || !!unifiVoucher.activatedAt
  if (wasUsed) {
    const usedAt = unifiVoucher.activatedAt ? new Date(unifiVoucher.activatedAt) : new Date()
    // A venda pertence ao caixa que está ABERTO no momento do uso, não à viagem em
    // que o voucher foi gerado. Vouchers de viagens anteriores continuam válidos e,
    // quando usados após o fechamento, a receita precisa cair na viagem corrente —
    // senão entra num caixa já fechado. Sem caixa aberto, mantém a viagem de origem.
    const openTrip = await prisma.trip.findFirst({
      where: { companyId: voucher.trip.companyId, closedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    const saleTripId = openTrip?.id ?? voucher.tripId
    await prisma.$transaction([
      prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          status: unifiVoucher.expired ? VoucherStatus.EXPIRED : VoucherStatus.ACTIVE,
          activatedAt: usedAt,
          expiresAt: unifiVoucher.expiresAt ? new Date(unifiVoucher.expiresAt) : null,
        },
      }),
      prisma.sale.create({
        data: {
          voucherId: voucher.id,
          tripId: saleTripId,
          sellerId: voucher.createdById,
          amount: voucher.plan.price,
          registeredAt: usedAt,
        },
      }),
    ])
  } else if (unifiVoucher.expired) {
    // Expirou sem ter sido usado → EXPIRED, sem venda
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: { status: VoucherStatus.EXPIRED, expiresAt: unifiVoucher.expiresAt ? new Date(unifiVoucher.expiresAt) : null },
    })
  }
}

/**
 * Sincroniza vouchers PENDING com o UniFi. Em vez de um GET por voucher, busca a
 * listagem completa de cada site uma única vez e cruza localmente — corta a carga
 * de N requisições para ~poucas por site e detecta vouchers sumidos de graça.
 * Roda a cada VOUCHER_SYNC_INTERVAL_MINUTES minutos (padrão: 2).
 */
export async function syncPendingVouchers(): Promise<void> {
  const pending = await prisma.voucher.findMany({
    where: { status: VoucherStatus.PENDING, unifiVoucherId: { not: null } },
    include: { plan: true, trip: { include: { company: true } } },
  })

  if (pending.length === 0) return

  // Agrupa os PENDING por site, para uma listagem por site.
  const bySite = new Map<string, PendingVoucher[]>()
  for (const voucher of pending) {
    const siteId = voucher.trip.company.unifiSiteId
    const group = bySite.get(siteId)
    if (group) group.push(voucher)
    else bySite.set(siteId, [voucher])
  }

  for (const [siteId, vouchers] of bySite) {
    let unifiById: Map<string, UnifiVoucher>
    try {
      const list = await unifiService.getVouchers(siteId)
      unifiById = new Map(list.map((v) => [v.id, v]))
    } catch (err) {
      // Falha ao listar (rede/timeout/5xx) — pula o site neste ciclo sem mexer nos
      // contadores de ausência, para não excluir vouchers por instabilidade.
      console.error(`Erro ao listar vouchers do site ${siteId}:`, err)
      continue
    }

    for (const voucher of vouchers) {
      try {
        await reconcileVoucher(voucher, unifiById.get(voucher.unifiVoucherId!))
      } catch (err) {
        console.error(`Erro ao sincronizar voucher ${voucher.id}:`, err)
      }
    }
  }
}

export function startVoucherSyncJob(): void {
  const interval = Number(process.env.VOUCHER_SYNC_INTERVAL_MINUTES ?? 2)
  cron.schedule(`*/${interval} * * * *`, syncPendingVouchers)
  console.log(`Voucher sync job iniciado (a cada ${interval} min)`)
}
