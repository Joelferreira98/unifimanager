/**
 * Backfill de vendas perdidas.
 *
 * Re-verifica no controlador UniFi os vouchers que NÃO têm venda no nosso banco
 * e, se a controladora indicar que foram usados (authorizedGuestCount > 0, ou
 * activatedAt), cria a Sale faltante. Recupera vendas que o bug antigo de ordem
 * do sync deixou como EXPIRED sem venda.
 *
 * Uso:
 *   node scripts/backfill-sales.js           # DRY-RUN (não grava nada)
 *   node scripts/backfill-sales.js --apply   # aplica de verdade
 *
 * IMPORTANTE: rode com o controlador ESTÁVEL. Ele anda "piscando" (mesmo voucher
 * alterna 404/200); o script tenta ler a lista várias vezes e usa a maior, mas se
 * o número lido vier muito baixo, é sinal de fase instável — não aplique ainda.
 */
require('dotenv/config')
const { PrismaClient, VoucherStatus } = require('@prisma/client')
const { unifiService } = require('../dist/services/UnifiService.js')

const APPLY = process.argv.includes('--apply')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Lê a lista completa de vouchers de um site, com retry (pega a maior leitura).
async function listAll(siteId, tries = 6, gap = 2000) {
  let best = []
  for (let i = 0; i < tries; i++) {
    try {
      const list = await unifiService.getVouchers(siteId)
      if (list.length > best.length) best = list
    } catch (e) {
      // ignora e tenta de novo
    }
    if (i < tries - 1) await sleep(gap)
  }
  return best
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const targets = await prisma.voucher.findMany({
      where: {
        sale: { is: null },
        unifiVoucherId: { not: null },
        status: { not: VoucherStatus.CANCELLED },
      },
      include: {
        plan: { select: { price: true } },
        trip: { include: { company: { select: { unifiSiteId: true } } } },
      },
    })
    console.log(`Alvos (sem venda, com unifiVoucherId): ${targets.length}`)
    if (targets.length === 0) {
      console.log('Nada a fazer.')
      return
    }

    const sites = [...new Set(targets.map((t) => t.trip.company.unifiSiteId))]
    const mapById = new Map()
    let totalRead = 0
    for (const site of sites) {
      const list = await listAll(site)
      totalRead += list.length
      console.log(`Site ${site}: ${list.length} vouchers lidos do controlador`)
      for (const v of list) mapById.set(v.id, v)
    }

    let recover = 0
    let unused = 0
    let notFound = 0
    const recovered = []

    for (const t of targets) {
      const uv = mapById.get(t.unifiVoucherId)
      if (!uv) {
        notFound++
        continue
      }
      const used = (uv.authorizedGuestCount ?? 0) > 0 || !!uv.activatedAt
      if (!used) {
        unused++
        continue
      }
      recover++
      const usedAt = uv.activatedAt ? new Date(uv.activatedAt) : new Date()
      recovered.push({ code: t.code, amount: String(t.plan.price), registeredAt: usedAt.toISOString() })
      if (APPLY) {
        await prisma.$transaction([
          prisma.voucher.update({
            where: { id: t.id },
            data: {
              status: uv.expired ? VoucherStatus.EXPIRED : VoucherStatus.ACTIVE,
              activatedAt: usedAt,
              expiresAt: uv.expiresAt ? new Date(uv.expiresAt) : null,
            },
          }),
          prisma.sale.create({
            data: {
              voucherId: t.id,
              tripId: t.tripId,
              sellerId: t.createdById,
              amount: t.plan.price,
              registeredAt: usedAt,
            },
          }),
        ])
      }
    }

    console.log(`\n===== RESULTADO ${APPLY ? '(APLICADO)' : '(DRY-RUN — nada gravado)'} =====`)
    console.log(`  vendas ${APPLY ? 'recuperadas' : 'a recuperar'}: ${recover}`)
    console.log(`  encontrados mas NÃO usados (continuam sem venda): ${unused}`)
    console.log(`  não encontrados no controlador (irrecuperáveis agora): ${notFound}`)
    if (recovered.length) {
      const total = recovered.reduce((s, r) => s + Number(r.amount), 0)
      console.log(`  valor total ${APPLY ? 'recuperado' : 'a recuperar'}: R$ ${total.toFixed(2)}`)
    }
    if (totalRead < targets.length * 0.5) {
      console.log(`\n  ⚠️  Leitura baixa (${totalRead} lidos p/ ${targets.length} alvos). O controlador pode`)
      console.log('      estar instável — rode de novo quando estiver estável antes de --apply.')
    }
    if (!APPLY && recover > 0) {
      console.log('\nPara aplicar:  node scripts/backfill-sales.js --apply')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('Falhou:', e)
  process.exit(1)
})
