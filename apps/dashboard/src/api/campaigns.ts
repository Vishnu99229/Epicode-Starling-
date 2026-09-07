import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'

import { api } from '@/api/client'
import type { Campaign, CampaignCreate } from '@/types'

export const campaignKeys = {
  all: ['campaigns'] as const,
  lists: () => [...campaignKeys.all, 'list'] as const,
  detail: (id: string) => [...campaignKeys.all, 'detail', id] as const,
}

export function listCampaigns() {
  return api.get<Campaign[]>('/campaigns')
}

export function getCampaign(id: string) {
  return api.get<Campaign>(`/campaigns/${id}`)
}

export function createCampaign(body: CampaignCreate) {
  return api.post<Campaign>('/campaigns', body)
}

export function startCampaign(id: string) {
  return api.post<Campaign>(`/campaigns/${id}/start`)
}

export function pauseCampaign(id: string) {
  return api.post<Campaign>(`/campaigns/${id}/pause`)
}

export function stopCampaign(id: string) {
  return api.post<Campaign>(`/campaigns/${id}/stop`)
}

export function useCampaigns(
  options?: Omit<UseQueryOptions<Campaign[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: campaignKeys.lists(),
    queryFn: listCampaigns,
    ...options,
  })
}

export function useCampaign(
  id: string,
  options?: Omit<UseQueryOptions<Campaign, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => getCampaign(id),
    enabled: Boolean(id),
    ...options,
  })
}

export function useCreateCampaign(
  options?: UseMutationOptions<Campaign, Error, CampaignCreate>,
) {
  const qc = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: createCampaign,
    onSuccess: (...args) => {
      void qc.invalidateQueries({ queryKey: campaignKeys.all })
      options?.onSuccess?.(...args)
    },
  })
}

function useCampaignAction(
  action: (id: string) => Promise<Campaign>,
  options?: UseMutationOptions<Campaign, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: action,
    onSuccess: (data, vars, onMutateResult, context) => {
      void qc.invalidateQueries({ queryKey: campaignKeys.all })
      void qc.setQueryData(campaignKeys.detail(data.id), data)
      options?.onSuccess?.(data, vars, onMutateResult, context)
    },
  })
}

export function useStartCampaign(
  options?: UseMutationOptions<Campaign, Error, string>,
) {
  return useCampaignAction(startCampaign, options)
}

export function usePauseCampaign(
  options?: UseMutationOptions<Campaign, Error, string>,
) {
  return useCampaignAction(pauseCampaign, options)
}

export function useStopCampaign(
  options?: UseMutationOptions<Campaign, Error, string>,
) {
  return useCampaignAction(stopCampaign, options)
}
