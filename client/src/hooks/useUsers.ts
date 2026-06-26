import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { User } from '../types'

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  })
}

export function useCreateManager() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      api.post('/users/managers', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useCreateSeller() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; companyId: string }) =>
      api.post('/users/sellers', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

// MASTER: concede/revoga acesso ao relatório geral da frota.
export function useSetGlobalReportAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, canView }: { id: string; canView: boolean }) =>
      api.patch(`/users/${id}/global-reports`, { canViewGlobalReports: canView }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (data: { name?: string; email?: string }) =>
      api.patch('/users/me', data).then((r) => r.data as User),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/users/me/password', data),
  })
}
