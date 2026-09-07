import { z } from 'zod'

/** Upload / scrub pipeline for a contact CSV. */
export const contactListStatusSchema = z.enum(['ready', 'processing', 'failed'])

export const contactListSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: contactListStatusSchema,
  contactCount: z.number().int().nonnegative(),
  validCount: z.number().int().nonnegative(),
  invalidCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
  columns: z.array(z.string()).default([]),
  sourceFilename: z.string().optional(),
  uploadedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
})

export type ContactList = z.infer<typeof contactListSchema>
export type ContactListStatus = z.infer<typeof contactListStatusSchema>

/** Per-row validation after upload / DND scrub. */
export const contactRowStatusSchema = z.enum([
  'valid',
  'invalid_number',
  'duplicate',
  'dnd',
])

export const contactAttributesSchema = z
  .object({
    city: z.string().optional(),
    loanAmount: z.number().nonnegative().optional(),
    dueDate: z.string().optional(),
    policyNumber: z.string().optional(),
    orderId: z.string().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]))

export const contactSchema = z.object({
  id: z.string().uuid(),
  listId: z.string().uuid(),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/),
  displayName: z.string().optional(),
  status: contactRowStatusSchema,
  dndFlag: z.boolean().default(false),
  attributes: contactAttributesSchema.default({}),
  createdAt: z.string().datetime(),
})

export type Contact = z.infer<typeof contactSchema>
export type ContactRowStatus = z.infer<typeof contactRowStatusSchema>
export type ContactAttributes = z.infer<typeof contactAttributesSchema>

export const contactListValidateResultSchema = z.object({
  listId: z.string().uuid(),
  status: contactListStatusSchema,
  contactCount: z.number().int().nonnegative(),
  validCount: z.number().int().nonnegative(),
  invalidCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
})

export type ContactListValidateResult = z.infer<typeof contactListValidateResultSchema>
