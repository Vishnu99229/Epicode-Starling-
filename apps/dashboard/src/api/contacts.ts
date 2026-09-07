import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'

import { api } from '@/api/client'
import type {
  Contact,
  ContactList,
  ContactListValidateResult,
} from '@/types'

export const contactKeys = {
  all: ['contacts'] as const,
  lists: () => [...contactKeys.all, 'lists'] as const,
  listDetail: (id: string) => [...contactKeys.all, 'list', id] as const,
  rows: (listId: string) => [...contactKeys.all, 'rows', listId] as const,
}

export function listContactLists() {
  return api.get<ContactList[]>('/contact-lists')
}

export function getContactList(id: string) {
  return api.get<ContactList>(`/contact-lists/${id}`)
}

export function listContacts(listId: string) {
  return api.get<Contact[]>(`/contact-lists/${listId}/contacts`)
}

export function uploadContactList(body: {
  name: string
  sourceFilename?: string
  contacts: Array<{
    phoneE164: string
    displayName?: string
    attributes?: Record<string, string | number | boolean>
  }>
}) {
  return api.post<ContactList>('/contact-lists/upload', body)
}

export function validateContactList(id: string) {
  return api.post<ContactListValidateResult>(`/contact-lists/${id}/validate`)
}

export function useContactLists(
  options?: Omit<UseQueryOptions<ContactList[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: contactKeys.lists(),
    queryFn: listContactLists,
    ...options,
  })
}

export function useContactList(
  id: string,
  options?: Omit<UseQueryOptions<ContactList, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: contactKeys.listDetail(id),
    queryFn: () => getContactList(id),
    enabled: Boolean(id),
    ...options,
  })
}

export function useContacts(
  listId: string,
  options?: Omit<UseQueryOptions<Contact[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery({
    queryKey: contactKeys.rows(listId),
    queryFn: () => listContacts(listId),
    enabled: Boolean(listId),
    ...options,
  })
}

export function useUploadContactList(
  options?: UseMutationOptions<
    ContactList,
    Error,
    Parameters<typeof uploadContactList>[0]
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: uploadContactList,
    onSuccess: (...args) => {
      void qc.invalidateQueries({ queryKey: contactKeys.all })
      options?.onSuccess?.(...args)
    },
  })
}

export function useValidateContactList(
  options?: UseMutationOptions<ContactListValidateResult, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: validateContactList,
    onSuccess: (...args) => {
      void qc.invalidateQueries({ queryKey: contactKeys.all })
      options?.onSuccess?.(...args)
    },
  })
}
