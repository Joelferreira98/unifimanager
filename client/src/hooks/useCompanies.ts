import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { Company } from '../types'

export function useCompanies() {
  return useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: () => api.get('/companies').then((r) => r.data),
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; unifiSiteId: string }) =>
      api.post('/companies', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; unifiSiteId?: string }) =>
      api.patch(`/companies/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useDeleteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useAssignManager() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ companyId, managerId }: { companyId: string; managerId: string }) =>
      api.post(`/companies/${companyId}/managers/${managerId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useRemoveManager() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ companyId, managerId }: { companyId: string; managerId: string }) =>
      api.delete(`/companies/${companyId}/managers/${managerId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}
