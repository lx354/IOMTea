import { useQuery } from '@tanstack/react-query'
import { fetchStatusMatrix } from '../api/client'
import type { PatientStatusResult } from '../api/client'

export function useTwinStatus() {
  return useQuery<PatientStatusResult[]>({
    queryKey: ['twin', 'status-matrix'],
    queryFn: fetchStatusMatrix,
    refetchInterval: 30_000,
  })
}
