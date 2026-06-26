export type Role = 'MASTER' | 'MANAGER' | 'SELLER'
export type VoucherStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'

export interface UnifiSite {
  id: string
  name: string
  internalReference: string
}

export interface Plan {
  id: string
  companyId: string
  name: string
  price: number
  timeLimitMinutes: number
  dataUsageLimitMBytes?: number
  rxRateLimitKbps?: number
  txRateLimitKbps?: number
  active: boolean
  createdAt: string
}

export interface Manager {
  id: string
  name: string
  email: string
}

export interface Company {
  id: string
  name: string
  unifiSiteId: string
  active: boolean
  plans: { id: string }[]
  managers: { managerId: string; companyId: string; manager: Manager }[]
  _count: { sellers: number }
  createdAt: string
}

export interface VoucherTemplate {
  id: string
  companyId: string
  logoUrl: string | null
  bgColor: string
  textColor: string
  accentColor: string
  borderColor: string
  headerText: string | null
  subtitle: string | null
  wifiName: string | null
  instructions: string | null
  footerText: string | null
  cardsPerRow: number
  showLogo: boolean
  showPrice: boolean
  showPlan: boolean
  showDuration: boolean
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  companyId?: string
  canViewGlobalReports?: boolean
  createdAt: string
}

export interface Voucher {
  id: string
  code: string
  status: VoucherStatus
  planId: string
  plan: { name: string; price: number; timeLimitMinutes: number }
  companyId: string
  createdById: string
  createdBy: { name: string }
  tripId: string
  sale?: { amount: number; registeredAt: string } | null
  generatedAt: string
  activatedAt?: string | null
  expiresAt?: string | null
}

export interface Sale {
  id: string
  voucherId: string
  voucher: { code: string; plan: { name: string; timeLimitMinutes?: number } }
  tripId: string
  sellerId: string
  seller: { name: string }
  amount: number
  registeredAt: string
}

export interface SalesResponse {
  total: number
  count: number
  sales: Sale[]
}

export interface Trip {
  id: string
  companyId: string
  active: boolean
  openedAt: string
  closedAt?: string | null
  totalRevenue: number
  _count: { vouchers: number; sales: number }
}

export interface ReportBreakdownItem {
  id: string
  name: string
  salesCount: number
  revenue: number
}

export interface ReportDayPoint {
  date: string
  salesCount: number
  revenue: number
}

export interface ReportTripPoint {
  id: string
  number: number
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
  summary: {
    totalRevenue: number
    salesCount: number
    avgTicket: number
    activeSellers: number
    plansSold: number
    tripsInRange: number
  }
  byPlan: ReportBreakdownItem[]
  bySeller: ReportBreakdownItem[]
  byDay: ReportDayPoint[]
  byTrip: ReportTripPoint[]
  aiAvailable: boolean
}

export interface ReportInsights {
  insights: string
  generatedAt: string
}

export interface GlobalCompanyPoint {
  id: string
  name: string
  salesCount: number
  revenue: number
  avgTicket: number
  tripsWithSales: number
  hasActiveTrip: boolean
}

export interface GlobalReport {
  range: { from: string; to: string }
  summary: {
    totalRevenue: number
    salesCount: number
    avgTicket: number
    totalCompanies: number
    sellingCompanies: number
  }
  byCompany: GlobalCompanyPoint[]
  byDay: ReportDayPoint[]
  aiAvailable: boolean
}
