import { Controller, useFormContext, useWatch } from 'react-hook-form'

import { Field, Select } from '@/components/ui/field'
import { KNOWLEDGE_BASES, modelsForLlm } from '@/lib/agent-options'
import type { AgentCreate } from '@/types'

import { RangeRow, Section } from '../Section'

export function IntelligenceTab() {
  const { register, control, setValue, formState } = useFormContext<AgentCreate>()
  const provider = useWatch({ control, name: 'llm.provider' })
  const selectedKb = useWatch({ control, name: 'llm.knowledgeBaseIds' }) ?? []
  const models = modelsForLlm(provider)

  return (
    <div className="space-y-4">
      <Section title="Choose LLM model">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Provider" error={formState.errors.llm?.provider?.message}>
            <Select {...register('llm.provider')}>
              <option value="groq">groq</option>
              <option value="openai">openai</option>
              <option value="azure">azure</option>
              <option value="anthropic">anthropic</option>
              <option value="google">google</option>
            </Select>
          </Field>
          <Field label="Model" error={formState.errors.llm?.model?.message}>
            <Select {...register('llm.model')}>
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Model parameters">
        <Field label="Tokens generated on each LLM output">
          <Controller
            control={control}
            name="llm.maxTokens"
            render={({ field }) => (
              <RangeRow
                min={32}
                max={2048}
                step={16}
                value={Number(field.value)}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        <Field label="Temperature">
          <Controller
            control={control}
            name="llm.temperature"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className="w-full accent-[var(--live)]"
                />
                <span className="metric w-12 text-right text-xs text-muted">
                  {Number(field.value).toFixed(2)}
                </span>
              </div>
            )}
          />
        </Field>
        <Field
          label="Reasoning effort"
          hint="Low reduces wasted reasoning tokens on short voice turns."
        >
          <Select {...register('llm.reasoningEffort')}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </Select>
        </Field>
      </Section>

      <Section title="Knowledge base">
        <div className="space-y-2">
          {KNOWLEDGE_BASES.map((kb) => (
            <label key={kb.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedKb.includes(kb.id)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selectedKb, kb.id]
                    : selectedKb.filter((id) => id !== kb.id)
                  setValue('llm.knowledgeBaseIds', next)
                }}
              />
              {kb.label}
            </label>
          ))}
        </div>
      </Section>
    </div>
  )
}
