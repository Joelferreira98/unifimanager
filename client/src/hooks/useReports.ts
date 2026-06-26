import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import type { CompanyReport, GlobalReport, ReportInsights } from '../types'

export interface ReportRange {
  from: string // ISO
  to: string // ISO
}

export function useCompanyReport(companyId: string | null, range: ReportRange) {
  return useQuery<CompanyReport>({
    queryKey: ['report', companyId, range.from, range.to],
    queryFn: () =>
      api
        .get(`/reports/company/${companyId}`, { params: range })
        .then((r) => r.data),
    enabled: !!companyId,
  })
}

// Insights de IA sob demanda (custo/latência) — mutation, não roda sozinho.
export function useReportInsights(companyId: string | null) {
  return useMutation<ReportInsights, unknown, ReportRange>({
    mutationFn: (range) =>
      api
        .post(`/reports/company/${companyId}/insights`, range)
        .then((r) => r.data),
  })
}

// Relatório geral da frota (todas as embarcações).
export function useGlobalReport(range: ReportRange, enabled = true) {
  return useQuery<GlobalReport>({
    queryKey: ['report', 'global', range.from, range.to],
    queryFn: () => api.get('/reports/global', { params: range }).then((r) => r.data),
    enabled,
  })
}

export function useGlobalReportInsights() {
  return useMutation<ReportInsights, unknown, ReportRange>({
    mutationFn: (range) => api.post('/reports/global/insights', range).then((r) => r.data),
  })
}
