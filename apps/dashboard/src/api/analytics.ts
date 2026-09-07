import { useQuery, type UseQueryOptions } from '@tanstack/react-query'

import { api } from '@/api/client'
import type { AnalyticsOverview, CallLog, CampaignStats } from '@/types'

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: () => [...analyticsKeys.all, 'overview'] as const,
  campaignStats: (id: string) => [...analyticsKeys.all, 'campaign', id] as const,
  campaignStatsList: () => [...analyticsKeys.all, 'campaigns'] as const,
  callLogs: (campaignId?: string) =>
    [...analyticsKeys.all, 'call-logs', campaignId ?? 'all'] as const,
}

export function getOverview() {
  return api.get<AnalyticsOverview>('/analytics/overview')
}

export function getCampaignStats(campaignId: string) {
  return api.get<CampaignStats>(`/analytics/campaigns/${campaignId}`)
}

export function listCampaignStats() {
  return api.get<CampaignStats[]>('/analytics/campaigns')
}

export function getCallLogs(campaignId?: string) {
  return api.get<CallLog[]>('/analytics/call-logs', {
    query: campaignId ? { campaignId } : undefined,
  })
}

export function useAnalyticsOverview(
  options?: Omit<UseQueryOptions<AnalyticsOverview, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: analyticsKeys.overview(),
    queryFn: getOverview,
    ...options,
  })
}

export function useCampaignStats(
  campaignId: string,
  options?: Omit<UseQueryOptions<CampaignStats, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: analyticsKeys.campaignStats(campaignId),
    queryFn: () => getCampaignStats(campaignId),
    enabled: Boolean(campaignId),
    ...options,
  })
}

export function useCampaignStatsList(
  options?: Omit<UseQueryOptions<CampaignStats[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: analyticsKeys.campaignStatsList(),
    queryFn: listCampaignStats,
    ...options,
  })
}

export function useCallLogs(
  campaignId?: string,
  options?: Omit<UseQueryOptions<CallLog[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: analyticsKeys.callLogs(campaignId),
    queryFn: () => getCallLogs(campaignId),
    ...options,
  })
}
