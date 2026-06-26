import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import type { UnifiSite } from '../types'

export function useSites() {
  return useQuery<UnifiSite[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then((r) => r.data),
    staleTime: 5 * 60_000,
  })
}
