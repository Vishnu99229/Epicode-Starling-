import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, History } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useAgent, useCreateAgent, useUpdateAgent } from '@/api/agents'
import { AgentListRail } from '@/components/agents/AgentListRail'
import { AgentTab } from '@/components/agents/tabs/AgentTab'
import { CallingTab } from '@/components/agents/tabs/CallingTab'
import { EngineTab } from '@/components/agents/tabs/EngineTab'
import { ExtractionsTab } from '@/components/agents/tabs/ExtractionsTab'
import { IntelligenceTab } from '@/components/agents/tabs/IntelligenceTab'
import { LanguagesTab } from '@/components/agents/tabs/LanguagesTab'
import { ToolsTab } from '@/components/agents/tabs/ToolsTab'
import { toast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { BuilderSkeleton } from '@/components/skeletons/BuilderSkeleton'
import { Select, TextInput } from '@/components/ui/field'
import {
  AGENT_TABS,
  defaultAgentFormValues,
  estimateCost,
  modelsForLlm,
  modelsForStt,
  type AgentTabId,
  voicesForTts,
} from '@/lib/agent-options'
import { cn } from '@/lib/utils'
import { agentCreateSchema, type Agent, type AgentCreate } from '@/types'

function toFormValues(agent: Agent): AgentCreate {
  return agentCreateSchema.parse(agent)
}

export function AgentBuilderPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (AGENT_TABS.some((t) => t.id === params.get('tab'))
    ? params.get('tab')
    : 'agent') as AgentTabId
  const [search, setSearch] = useState('')

  const { data: existing, isLoading } = useAgent(id ?? '', { enabled: Boolean(id) })
  const form = useForm<AgentCreate>({
    resolver: zodResolver(agentCreateSchema),
    defaultValues: defaultAgentFormValues,
  })

  useEffect(() => {
    if (existing) form.reset(toFormValues(existing))
  }, [existing, form])

  const llmProvider = useWatch({ control: form.control, name: 'llm.provider' })
  const sttProvider = useWatch({ control: form.control, name: 'stt.provider' })
  const ttsProvider = useWatch({ control: form.control, name: 'tts.provider' })
  const voiceEngine = useWatch({ control: form.control, name: 'voiceEngine' }) ?? 'cascaded'
  const indiaRouting = useWatch({ control: form.control, name: 'indiaRouting' })

  useEffect(() => {
    const models = modelsForLlm(llmProvider)
    if (!models.some((m) => m.value === form.getValues('llm.model'))) {
      form.setValue('llm.model', models[0]!.value)
    }
  }, [form, llmProvider])

  useEffect(() => {
    const models = modelsForStt(sttProvider)
    if (!models.some((m) => m.value === form.getValues('stt.model'))) {
      form.setValue('stt.model', models[0]!.value)
    }
  }, [form, sttProvider])

  useEffect(() => {
    const voices = voicesForTts(ttsProvider)
    const current = form.getValues('tts.voice')
    const match = voices.find((v) => v.value === current)
    if (!match) {
      form.setValue('tts.voice', voices[0]!.value)
      form.setValue('tts.model', voices[0]!.model)
    }
  }, [form, ttsProvider])

  const create = useCreateAgent({
    onSuccess: (agent) => {
      toast('Agent saved')
      navigate(`/agents/${agent.id}?tab=${tab}`, { replace: true })
    },
  })
  const update = useUpdateAgent({
    onSuccess: () => toast('Agent saved'),
  })

  const cost = estimateCost(voiceEngine)

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: AgentCreate = {
      ...data,
      language: data.stt.language,
      tts: { ...data.tts, language: data.stt.language },
      llm: {
        ...data.llm,
        baseUrl: data.llm.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined,
      },
    }
    if (isNew) await create.mutateAsync(payload)
    else if (id) await update.mutateAsync({ id, body: payload })
  })

  if (!isNew && isLoading) {
    return <BuilderSkeleton />
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="flex h-full min-h-0">
        <AgentListRail search={search} onSearch={setSearch} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-line px-4 py-3">
            <div className="flex flex-wrap items-start gap-3">
              <TextInput
                className="min-w-48 flex-1 text-base font-semibold"
                {...form.register('name')}
              />
              <Fieldish label="Voice engine">
                <Select {...form.register('voiceEngine')}>
                  <option value="cascaded">Cascaded</option>
                  <option value="realtime">Realtime</option>
                </Select>
              </Fieldish>
              <div className="min-w-48 flex-1">
                <div className="mb-1 flex items-center justify-between text-xs text-muted">
                  <span>Cost / min</span>
                  <span className="metric text-text">₹{cost.total.toFixed(1)}</span>
                </div>
                <div className="flex h-1.5 overflow-hidden border border-line">
                  <span className="bg-text" style={{ width: `${(cost.agent / cost.total) * 100}%` }} />
                  <span className="bg-idle" style={{ width: `${(cost.telephony / cost.total) * 100}%` }} />
                  <span className="bg-muted" style={{ width: `${(cost.platform / cost.total) * 100}%` }} />
                </div>
                <div className="mt-1 flex gap-3 text-[11px] text-muted">
                  <span>Agent ₹{cost.agent.toFixed(1)}</span>
                  <span>Telephony ₹{cost.telephony.toFixed(1)}</span>
                  <span>Platform ₹{cost.platform.toFixed(1)}</span>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 border border-line px-2 py-1 text-xs">
                <input type="checkbox" {...form.register('indiaRouting')} />
                <span className={indiaRouting ? 'text-text' : 'text-muted'}>
                  India routing
                </span>
              </label>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Duplicate agent"
                onClick={() => toast('Duplicate is a stub')}
              >
                <Copy aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Version history"
                onClick={() => toast('Version history is a stub')}
              >
                <History aria-hidden />
              </Button>
            </div>
          </header>

          <nav className="flex gap-1 overflow-x-auto border-b border-line px-2">
            {AGENT_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'shrink-0 border-b-2 px-3 py-2 text-sm',
                  item.id === tab
                    ? 'border-text text-text'
                    : 'border-transparent text-muted',
                )}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('tab', item.id)
                  setParams(next, { replace: true })
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-auto p-4 pb-16">
            {tab === 'agent' ? <AgentTab /> : null}
            {tab === 'intelligence' ? <IntelligenceTab /> : null}
            {tab === 'languages' ? <LanguagesTab /> : null}
            {tab === 'calling' ? <CallingTab /> : null}
            {tab === 'engine' ? <EngineTab /> : null}
            {tab === 'tools' ? <ToolsTab /> : null}
            {tab === 'extractions' ? <ExtractionsTab /> : null}
          </div>

          <div className="pointer-events-none absolute right-4 bottom-4">
            <Button type="submit" className="pointer-events-auto" disabled={form.formState.isSubmitting}>
              Save agent
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}

function Fieldish({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}
