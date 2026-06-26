import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { VoucherTemplate } from '../types'

export function useVoucherTemplate(companyId: string | null) {
  return useQuery<VoucherTemplate>({
    queryKey: ['voucher-template', companyId],
    queryFn: () => api.get(`/voucher-templates/company/${companyId}`).then((r) => r.data),
    enabled: !!companyId,
  })
}

export function useUpdateVoucherTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ companyId, ...data }: Partial<VoucherTemplate> & { companyId: string }) =>
      api.put(`/voucher-templates/company/${companyId}`, data).then((r) => r.data as VoucherTemplate),
    onSuccess: (saved) =>
      qc.invalidateQueries({ queryKey: ['voucher-template', saved.companyId] }),
  })
}
