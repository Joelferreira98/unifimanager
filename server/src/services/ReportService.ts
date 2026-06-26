import { prisma } from '../lib/prisma'

export interface ReportRange {
  from: Date
  to: Date
}

export interface ReportSummary {
  totalRevenue: number
  salesCount: number
  avgTicket: number
  activeSellers: number
  plansSold: number
  tripsInRange: number
}

export interface ReportBreakdownItem {
  id: string
  name: string
  salesCount: number
  revenue: number
}

export interface ReportDayPoint {
  date: string // YYYY-MM-DD (fuso America/Sao_Paulo)
  salesCount: number
  revenue: number
}

export interface ReportTripPoint {
  id: string
  number: number // posição cronológica da viagem na empresa (1 = mais antiga)
  openedAt: string
  closedAt: string | null
  active: boolean
  salesCount: number
  revenue: number
  avgTicket: number
}

export interface CompanyReport {
  companyId: string
  companyName: string
  range: { from: string; to: string }
  summary: ReportSummary
  byPlan: ReportBreakdownItem[]
  bySeller: ReportBreakdownItem[]
  byDay: ReportDayPoint[]
  byTrip: ReportTripPoint[]
}

// --- Relatório geral (todas as embarcações) ---

export interface GlobalCompanyPoint {
  id: string
  name: string
  salesCount: number
  revenue: number
  avgTicket: number
  tripsWithSales: number // quantas viagens tiveram venda no período
  hasActiveTrip: boolean
}

export interface GlobalReport {
  range: { from: string; to: string }
  summary: {
    totalRevenue: number
    salesCount: number
    avgTicket: number
    totalCompanies: number // embarcações ativas na frota
    sellingCompanies: number // embarcações com ao menos 1 venda no período
  }
  byCompany: GlobalCompanyPoint[] // ordenado por quantidade de vendas (desc)
  byDay: ReportDayPoint[] // agregado de toda a frota
}

// Agrupa a data no fuso de Brasília (en-CA → YYYY-MM-DD).
const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function localDay(date: Date): string {
  return dayFmt.format(date)
}

/**
 * Consolida vendas de uma empresa em um período: receita total, ticket médio,
 * quebra por plano, por vendedor e evolução diária. Base para os relatórios e
 * para os insights de IA. A venda é contada por `registeredAt` (momento em que
 * o voucher foi conectado), nunca pela geração.
 */
export async function buildCompanyReport(
  companyId: string,
  range: ReportRange
): Promise<CompanyReport> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { id: true, name: true },
  })

  const sales = await prisma.sale.findMany({
    where: {
      trip: { companyId },
      registeredAt: { gte: range.from, lte: range.to },
    },
    select: {
      amount: true,
      registeredAt: true,
      sellerId: true,
      tripId: true,
      seller: { select: { name: true } },
      voucher: { select: { planId: true, plan: { select: { name: true } } } },
    },
    orderBy: { registeredAt: 'asc' },
  })

  // Todas as viagens da empresa em ordem cronológica → numeração estável (#1 = mais antiga).
  const allTrips = await prisma.trip.findMany({
    where: { companyId },
    orderBy: { openedAt: 'asc' },
    select: { id: true, openedAt: true, closedAt: true, active: true },
  })
  const tripNumber = new Map(allTrips.map((t, i) => [t.id, i + 1]))
  const tripMeta = new Map(allTrips.map((t) => [t.id, t]))

  const tripsInRange = await prisma.trip.count({
    where: { companyId, openedAt: { lte: range.to }, OR: [{ closedAt: null }, { closedAt: { gte: range.from } }] },
  })

  const planMap = new Map<string, ReportBreakdownItem>()
  const sellerMap = new Map<string, ReportBreakdownItem>()
  const dayMap = new Map<string, ReportDayPoint>()
  const tripAgg = new Map<string, { salesCount: number; revenue: number }>()
  let totalRevenue = 0

  for (const s of sales) {
    const amount = Number(s.amount)
    totalRevenue += amount

    const planId = s.voucher.planId
    const plan = planMap.get(planId) ?? { id: planId, name: s.voucher.plan.name, salesCount: 0, revenue: 0 }
    plan.salesCount++
    plan.revenue += amount
    planMap.set(planId, plan)

    const seller = sellerMap.get(s.sellerId) ?? { id: s.sellerId, name: s.seller.name, salesCount: 0, revenue: 0 }
    seller.salesCount++
    seller.revenue += amount
    sellerMap.set(s.sellerId, seller)

    const day = localDay(s.registeredAt)
    const point = dayMap.get(day) ?? { date: day, salesCount: 0, revenue: 0 }
    point.salesCount++
    point.revenue += amount
    dayMap.set(day, point)

    const trip = tripAgg.get(s.tripId) ?? { salesCount: 0, revenue: 0 }
    trip.salesCount++
    trip.revenue += amount
    tripAgg.set(s.tripId, trip)
  }

  const round2 = (n: number) => Math.round(n * 100) / 100
  const finalize = <T extends { revenue: number }>(item: T): T => ({ ...item, revenue: round2(item.revenue) })

  const byTrip: ReportTripPoint[] = [...tripAgg.entries()]
    .map(([id, agg]) => {
      const meta = tripMeta.get(id)
      return {
        id,
        number: tripNumber.get(id) ?? 0,
        openedAt: meta?.openedAt.toISOString() ?? '',
        closedAt: meta?.closedAt?.toISOString() ?? null,
        active: meta?.active ?? false,
        salesCount: agg.salesCount,
        revenue: round2(agg.revenue),
        avgTicket: agg.salesCount > 0 ? round2(agg.revenue / agg.salesCount) : 0,
      }
    })
    .sort((a, b) => a.number - b.number)

  const salesCount = sales.length

  return {
    companyId: company.id,
    companyName: company.name,
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    summary: {
      totalRevenue: round2(totalRevenue),
      salesCount,
      avgTicket: salesCount > 0 ? round2(totalRevenue / salesCount) : 0,
      activeSellers: sellerMap.size,
      plansSold: planMap.size,
      tripsInRange,
    },
    byPlan: [...planMap.values()].map(finalize).sort((a, b) => b.revenue - a.revenue),
    bySeller: [...sellerMap.values()].map(finalize).sort((a, b) => b.revenue - a.revenue),
    byDay: [...dayMap.values()].map(finalize).sort((a, b) => a.date.localeCompare(b.date)),
    byTrip,
  }
}

/**
 * Consolida as vendas de TODA a frota (todas as embarcações ativas) em um período.
 * A métrica central é a quantidade de vendas por embarcação. Relatório de gestão,
 * acessível ao MASTER e a quem ele permitir.
 */
export async function buildGlobalReport(range: ReportRange): Promise<GlobalReport> {
  const companies = await prisma.company.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const sales = await prisma.sale.findMany({
    where: { registeredAt: { gte: range.from, lte: range.to } },
    select: {
      amount: true,
      registeredAt: true,
      tripId: true,
      trip: { select: { companyId: true } },
    },
    orderBy: { registeredAt: 'asc' },
  })

  // Embarcações com viagem em aberto (no máximo uma por empresa).
  const activeTrips = await prisma.trip.findMany({
    where: { active: true },
    select: { companyId: true },
  })
  const activeTripCompanies = new Set(activeTrips.map((t) => t.companyId))

  type Agg = { salesCount: number; revenue: number; trips: Set<string> }
  const companyAgg = new Map<string, Agg>()
  const dayMap = new Map<string, ReportDayPoint>()
  let totalRevenue = 0

  for (const s of sales) {
    const amount = Number(s.amount)
    totalRevenue += amount
    const companyId = s.trip.companyId

    const agg = companyAgg.get(companyId) ?? { salesCount: 0, revenue: 0, trips: new Set<string>() }
    agg.salesCount++
    agg.revenue += amount
    agg.trips.add(s.tripId)
    companyAgg.set(companyId, agg)

    const day = localDay(s.registeredAt)
    const point = dayMap.get(day) ?? { date: day, salesCount: 0, revenue: 0 }
    point.salesCount++
    point.revenue += amount
    dayMap.set(day, point)
  }

  const round2 = (n: number) => Math.round(n * 100) / 100

  const byCompany: GlobalCompanyPoint[] = companies
    .map((c) => {
      const agg = companyAgg.get(c.id)
      const salesCount = agg?.salesCount ?? 0
      const revenue = agg ? round2(agg.revenue) : 0
      return {
        id: c.id,
        name: c.name,
        salesCount,
        revenue,
        avgTicket: salesCount > 0 ? round2(revenue / salesCount) : 0,
        tripsWithSales: agg?.trips.size ?? 0,
        hasActiveTrip: activeTripCompanies.has(c.id),
      }
    })
    .sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue || a.name.localeCompare(b.name))

  const salesCount = sales.length

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    summary: {
      totalRevenue: round2(totalRevenue),
      salesCount,
      avgTicket: salesCount > 0 ? round2(totalRevenue / salesCount) : 0,
      totalCompanies: companies.length,
      sellingCompanies: companyAgg.size,
    },
    byCompany,
    byDay: [...dayMap.values()]
      .map((d) => ({ ...d, revenue: round2(d.revenue) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }
}
