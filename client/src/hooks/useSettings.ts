import { useMutation } from '@tanstack/react-query'
import { api } from '../services/api'
import type { AppSettings } from '../store/settingsStore'

export function useUpdateSettings() {
  return useMutation({
    mutationFn: (data: Partial<AppSettings>) =>
      api.put('/settings', data).then((r) => r.data as AppSettings),
  })
}
