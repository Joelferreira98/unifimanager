import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { Trip } from '../types'

export function useActiveTrip(companyId: string | null) {
  return useQuery<Trip>({
    queryKey: ['trip-active', companyId],
    queryFn: () => api.get(`/trips/company/${companyId}/active`).then((r) => r.data),
    enabled: !!companyId,
    retry: false,
  })
}

export function useTripHistory(companyId: string | null) {
  return useQuery<Trip[]>({
    queryKey: ['trip-history', companyId],
    queryFn: () => api.get(`/trips/company/${companyId}`).then((r) => r.data),
    enabled: !!companyId,
  })
}

export function useCloseTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (companyId: string) =>
      api.post(`/trips/company/${companyId}/close`).then((r) => r.data),
    onSuccess: (_d, companyId) => {
      qc.invalidateQueries({ queryKey: ['trip-active', companyId] })
      qc.invalidateQueries({ queryKey: ['trip-history', companyId] })
      qc.invalidateQueries({ queryKey: ['trip-sales'] })
    },
  })
}
