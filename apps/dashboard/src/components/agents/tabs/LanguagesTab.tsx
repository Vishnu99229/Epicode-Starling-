import { Controller, useFormContext, useWatch } from 'react-hook-form'

import { Field, Select, TextInput } from '@/components/ui/field'
import { modelsForStt, STT_LANGUAGES, voicesForTts } from '@/lib/agent-options'
import type { AgentCreate } from '@/types'

import { Section } from '../Section'

const STT_PROVIDERS = [
  'azure',
  'deepgram',
  'elevenlabs',
  'gemini',
  'gladia',
  'google',
  'openai',
  'sarvam',
  'smallest',
  'soniox',
] as const

const TTS_PROVIDERS = ['sarvam', 'elevenlabs', 'azure', 'smallest', 'cartesia'] as const

export function LanguagesTab() {
  const { register, control, setValue, formState } = useFormContext<AgentCreate>()
  const sttProvider = useWatch({ control, name: 'stt.provider' })
  const ttsProvider = useWatch({ control, name: 'tts.provider' })
  const sttModels = modelsForStt(sttProvider)
  const ttsVoices = voicesForTts(ttsProvider)

  return (
    <div className="space-y-4">
      <Section title="STT (ASR)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Provider">
            <Select {...register('stt.provider')}>
              {STT_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Model">
            <Select {...register('stt.model')}>
              {sttModels.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Language">
            <Select {...register('stt.language')}>
              {STT_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Keywords">
            <TextInput {...register('stt.keywords')} placeholder="EMI, Aadhaar, UPI" />
          </Field>
          <Field
            label="Transcript timeout (ms)"
            hint="Raise if the agent cuts off callers reading out digits."
            error={formState.errors.stt?.transcriptTimeoutMs?.message}
          >
            <TextInput type="number" min={100} {...register('stt.transcriptTimeoutMs')} />
          </Field>
          <Field
            label="Silence threshold (ms)"
            hint="Raise if the agent cuts off callers reading out digits."
            error={formState.errors.stt?.silenceThresholdMs?.message}
          >
            <TextInput type="number" min={100} {...register('stt.silenceThresholdMs')} />
          </Field>
        </div>
      </Section>

      <Section title="TTS">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Provider">
            <Select {...register('tts.provider')}>
              {TTS_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Voice">
            <Select
              {...register('tts.voice')}
              onChange={(e) => {
                const voice = ttsVoices.find((v) => v.value === e.target.value)
                setValue('tts.voice', e.target.value)
                if (voice) setValue('tts.model', voice.model)
              }}
            >
              {ttsVoices.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Speed">
            <Controller
              control={control}
              name="tts.speed"
              render={({ field }) => (
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0.5}
                    max={2}
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
          <Field label="Pitch">
            <Controller
              control={control}
              name="tts.pitch"
              render={({ field }) => (
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0.5}
                    max={2}
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
        </div>
      </Section>
    </div>
  )
}
