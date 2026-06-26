import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { Voucher } from '../types'

interface VoucherFilters {
  companyId?: string | null
  status?: string | null
  planId?: string | null
}

export function useVouchers(filters: VoucherFilters) {
  const params = new URLSearchParams()
  if (filters.companyId) params.set('companyId', filters.companyId)
  if (filters.status) params.set('status', filters.status)
  if (filters.planId) params.set('planId', filters.planId)

  return useQuery<Voucher[]>({
    queryKey: ['vouchers', filters],
    queryFn: () => api.get(`/vouchers?${params}`).then((r) => r.data),
    enabled: !!(filters.companyId),
  })
}

export function useGenerateVouchers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { planId: string; quantity: number }) =>
      api.post('/vouchers/generate', data).then((r) => r.data as Voucher[]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vouchers'] }),
  })
}

export function useCancelVoucher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/vouchers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vouchers'] }),
  })
}

export interface ImportableVoucher {
  unifiVoucherId: string
  code: string
  name: string
  timeLimitMinutes: number
  expired: boolean
  activatedAt: string | null
  used: boolean
  suggestedPlanId: string | null
}

export function useImportableVouchers(companyId: string | null, enabled: boolean) {
  return useQuery<ImportableVoucher[]>({
    queryKey: ['importable-vouchers', companyId],
    queryFn: () => api.get(`/vouchers/importable?companyId=${companyId}`).then((r) => r.data),
    enabled: !!companyId && enabled,
    staleTime: 0,
  })
}

export function useImportVouchers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { companyId: string; items: { unifiVoucherId: string; planId: string }[] }) =>
      api.post('/vouchers/import', data).then((r) => r.data as { imported: number; skipped: number }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['vouchers'] })
      qc.invalidateQueries({ queryKey: ['importable-vouchers', vars.companyId] })
    },
  })
}
