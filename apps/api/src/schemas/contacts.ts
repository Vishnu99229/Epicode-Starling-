import { z } from 'zod'

const attributesSchema = z.record(
  z.union([z.string(), z.number(), z.boolean()]),
)

const uploadRowSchema = z.object({
  phoneNumber: z.string(),
  name: z.string().optional(),
  attributes: attributesSchema.optional(),
})

const legacyContactRowSchema = z.object({
  phoneE164: z.string().optional(),
  phoneNumber: z.string().optional(),
  displayName: z.string().optional(),
  name: z.string().optional(),
  attributes: attributesSchema.optional(),
})

export const contactListUploadSchema = z
  .object({
    name: z.string().min(1, 'name is required'),
    sourceFilename: z.string().optional(),
    columns: z.array(z.string()).optional(),
    rows: z.array(uploadRowSchema).optional(),
    contacts: z.array(legacyContactRowSchema).optional(),
  })
  .superRefine((body, ctx) => {
    const rowCount = (body.rows?.length ?? 0) + (body.contacts?.length ?? 0)
    if (rowCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rows or contacts is required and must be non-empty',
        path: ['rows'],
      })
    }
  })

export const listContactsQuerySchema = z.object({
  search: z.string().optional(),
  status: z
    .enum(['valid', 'invalid_number', 'duplicate', 'dnd'])
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
})

export type ContactListUploadBody = z.infer<typeof contactListUploadSchema>
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>
