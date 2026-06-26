import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { SalesResponse } from '../types'

export function useTripSales(tripId: string | null) {
  return useQuery<SalesResponse>({
    queryKey: ['trip-sales', tripId],
    queryFn: () => api.get(`/sales/trip/${tripId}`).then((r) => r.data),
    enabled: !!tripId,
    refetchInterval: 30_000,
  })
}

// Remove a venda do caixa e cancela o voucher (MASTER). Atualiza o caixa e as viagens.
export function useRemoveSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/sales/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-sales'] })
      qc.invalidateQueries({ queryKey: ['trip-active'] })
      qc.invalidateQueries({ queryKey: ['trip-history'] })
      qc.invalidateQueries({ queryKey: ['vouchers'] })
    },
  })
}
