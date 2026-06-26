import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export interface DashboardSummary {
  total: number // vouchers gerados no período
  revenue: number // receita do período
  pending: number // ao vivo
  active: number // ao vivo
  byDay: { date: string; revenue: number }[] // YYYY-MM-DD (fuso America/Sao_Paulo)
}

export function useDashboardSummary(companyId: string | null, range: { from: string; to: string }) {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard', companyId, range.from, range.to],
    queryFn: () =>
      api.get(`/dashboard/company/${companyId}`, { params: range }).then((r) => r.data),
    enabled: !!companyId,
  })
}
