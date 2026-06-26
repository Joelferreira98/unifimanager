import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, authorize } from '../middlewares/auth'
import { companyAccessError } from '../lib/companyAccess'
import { buildCompanyReport, buildGlobalReport, type ReportRange } from '../services/ReportService'
import { aiInsightsService, AiNotConfiguredError } from '../services/AiInsightsService'

export const reportsRoutes = Router()

reportsRoutes.use(authenticate)

// Período padrão: últimos 30 dias.
const rangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

function resolveRange(raw: { from?: Date; to?: Date }): ReportRange {
  const to = raw.to ?? new Date()
  const from = raw.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { from, to }
}

// Relatórios por empresa são de gestão: MASTER e MANAGER.
const companyReports = authorize(Role.MASTER, Role.MANAGER)

// Relatório geral da frota: MASTER sempre; outros usuários só com permissão concedida.
async function authorizeGlobalReports(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user.role === Role.MASTER) {
    next()
    return
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { active: true, canViewGlobalReports: true },
  })
  if (user?.active && user.canViewGlobalReports) {
    next()
    return
  }
  res.status(403).json({ message: 'Você não tem acesso ao relatório geral' })
}

// --- Relatório geral (frota) ---

reportsRoutes.get('/global', authorizeGlobalReports, async (req, res) => {
  const range = resolveRange(rangeSchema.parse(req.query))
  const report = await buildGlobalReport(range)
  res.json({ ...report, aiAvailable: aiInsightsService.isConfigured })
})

reportsRoutes.post('/global/insights', authorizeGlobalReports, async (req, res) => {
  const range = resolveRange(rangeSchema.parse(req.body))
  const report = await buildGlobalReport(range)
  try {
    const insights = await aiInsightsService.generateGlobalInsights(report)
    res.json({ insights, generatedAt: new Date().toISOString() })
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      res.status(503).json({ message: err.message })
      return
    }
    throw err
  }
})

// Métricas consolidadas (sem IA) — carregam rápido e alimentam os gráficos.
reportsRoutes.get('/company/:companyId', companyReports, async (req, res) => {
  const accessErr = await companyAccessError(req.user, req.params.companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const range = resolveRange(rangeSchema.parse(req.query))
  const report = await buildCompanyReport(req.params.companyId, range)
  res.json({ ...report, aiAvailable: aiInsightsService.isConfigured })
})

// Insights de IA sob demanda (latência e custo): recalcula as métricas no
// servidor para o período pedido e gera a análise textual.
reportsRoutes.post('/company/:companyId/insights', companyReports, async (req, res) => {
  const accessErr = await companyAccessError(req.user, req.params.companyId)
  if (accessErr) {
    res.status(403).json({ message: accessErr })
    return
  }

  const range = resolveRange(rangeSchema.parse(req.body))
  const report = await buildCompanyReport(req.params.companyId, range)

  try {
    const insights = await aiInsightsService.generateInsights(report)
    res.json({ insights, generatedAt: new Date().toISOString() })
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      res.status(503).json({ message: err.message })
      return
    }
    throw err
  }
})
