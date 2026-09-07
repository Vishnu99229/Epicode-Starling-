import type { ZodTypeAny } from 'zod'

/** Dev-time guard — fixtures must match zod schemas or fail loudly on import. */
export function assertFixtures<T>(
  label: string,
  schema: ZodTypeAny,
  items: unknown[],
): asserts items is T[] {
  const result = schema.array().safeParse(items)
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`[fixtures] ${label} failed schema validation: ${detail}`)
  }
}

export function delay(msMin = 300, msMax = 600): Promise<void> {
  const ms = msMin + Math.floor(Math.random() * (msMax - msMin + 1))
  return new Promise((resolve) => setTimeout(resolve, ms))
}
