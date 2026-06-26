import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { Plan } from '../types'

export function usePlans(companyId: string | null) {
  return useQuery<Plan[]>({
    queryKey: ['plans', companyId],
    queryFn: () => api.get(`/plans/company/${companyId}`).then((r) => r.data),
    enabled: !!companyId,
  })
}

interface PlanPayload {
  companyId: string
  name: string
  price: number
  timeLimitMinutes: number
  dataUsageLimitMBytes?: number
  rxRateLimitKbps?: number
  txRateLimitKbps?: number
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlanPayload) => api.post('/plans', data).then((r) => r.data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['plans', vars.companyId] }),
  })
}

export function useUpdatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, companyId, ...data }: Partial<PlanPayload> & { id: string; companyId: string }) =>
      api.patch(`/plans/${id}`, data).then((r) => r.data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['plans', vars.companyId] }),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, companyId }: { id: string; companyId: string }) =>
      api.delete(`/plans/${id}`).then(() => companyId),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['plans', vars.companyId] }),
  })
}
