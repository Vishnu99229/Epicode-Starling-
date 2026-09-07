import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'

import { api } from '@/api/client'
import type { Agent, AgentCreate, AgentUpdate } from '@/types'

export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  detail: (id: string) => [...agentKeys.all, 'detail', id] as const,
}

export function listAgents() {
  return api.get<Agent[]>('/agents')
}

export function getAgent(id: string) {
  return api.get<Agent>(`/agents/${id}`)
}

export function createAgent(body: AgentCreate) {
  return api.post<Agent>('/agents', body)
}

export function updateAgent(id: string, body: AgentUpdate) {
  return api.patch<Agent>(`/agents/${id}`, body)
}

export function useAgents(
  options?: Omit<UseQueryOptions<Agent[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: agentKeys.lists(),
    queryFn: listAgents,
    ...options,
  })
}

export function useAgent(
  id: string,
  options?: Omit<UseQueryOptions<Agent, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: () => getAgent(id),
    enabled: Boolean(id),
    ...options,
  })
}

export function useCreateAgent(
  options?: UseMutationOptions<Agent, Error, AgentCreate>,
) {
  const qc = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: createAgent,
    onSuccess: (...args) => {
      void qc.invalidateQueries({ queryKey: agentKeys.all })
      options?.onSuccess?.(...args)
    },
  })
}

export function useUpdateAgent(
  options?: UseMutationOptions<Agent, Error, { id: string; body: AgentUpdate }>,
) {
  const qc = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: ({ id, body }) => updateAgent(id, body),
    onSuccess: (data, vars, onMutateResult, context) => {
      void qc.invalidateQueries({ queryKey: agentKeys.all })
      void qc.setQueryData(agentKeys.detail(data.id), data)
      options?.onSuccess?.(data, vars, onMutateResult, context)
    },
  })
}
