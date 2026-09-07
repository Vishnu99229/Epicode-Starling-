import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAgents } from '@/api/agents'
import { useCreateCampaign } from '@/api/campaigns'
import { useContactLists } from '@/api/contacts'
import { WizardStepIndicator } from '@/components/campaigns/WizardStepIndicator'
import { PageHeader } from '@/components/PageHeader'
import { toast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Field, Select, TextInput } from '@/components/ui/field'
import {
  DEFAULT_WIZARD_STATE,
  slugifyCampaignName,
  toWorkingHours,
  validateWizardStep,
  WIZARD_STEPS,
  type CampaignWizardState,
} from '@/lib/campaign-wizard'
import { cn } from '@/lib/utils'
import type { RetryOnOutcome } from '@/types'

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'UTC',
  'America/New_York',
  'Europe/London',
]

const RETRY_OPTIONS: Array<{ value: RetryOnOutcome; label: string }> = [
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'failed', label: 'Failed' },
]

export function CampaignWizardPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [state, setState] = useState<CampaignWizardState>(DEFAULT_WIZARD_STATE)
  const [stepError, setStepError] = useState<string | null>(null)

  const { data: lists = [], isLoading: listsLoading } = useContactLists()
  const { data: agents = [], isLoading: agentsLoading } = useAgents()
  const create = useCreateCampaign()

  const selectedList = lists.find((l) => l.id === state.contactListId)
  const selectedAgent = agents.find((a) => a.id === state.agentId)

  const activeAgents = useMemo(() => agents.filter((a) => a.status === 'active'), [agents])

  const patch = (partial: Partial<CampaignWizardState>) => {
    setState((prev) => ({ ...prev, ...partial }))
    setStepError(null)
  }

  const goNext = () => {
    const err = validateWizardStep(step, state)
    if (err) {
      setStepError(err)
      return
    }
    setStepError(null)
    setStep((s) => Math.min(5, s + 1))
  }

  const goBack = () => {
    setStepError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  const toggleRetryOn = (value: RetryOnOutcome) => {
    setState((prev) => {
      const has = prev.retryOn.includes(value)
      const retryOn = has ? prev.retryOn.filter((v) => v !== value) : [...prev.retryOn, value]
      return { ...prev, retryOn }
    })
    setStepError(null)
  }

  const onCreate = async () => {
    const err = validateWizardStep(5, state)
    if (err) {
      setStepError(err)
      return
    }
    const scheduledAt = state.scheduledAt
      ? new Date(state.scheduledAt).toISOString()
      : null
    try {
      const campaign = await create.mutateAsync({
        name: state.name.trim(),
        agentId: state.agentId,
        contactListId: state.contactListId,
        iravoiceCampaignName: slugifyCampaignName(state.name),
        pacing: {
          targetCps: state.targetCps,
          maxConcurrent: state.maxConcurrent,
          maxAttempts: state.maxAttempts,
          dialTimeoutSec: state.dialTimeoutSec,
          retryDelayMinutes: state.retryDelayMinutes,
          retryOn: state.retryOn,
        },
        callingWindow: {
          timezone: state.timezone,
          startLocal: state.startLocal,
          endLocal: state.endLocal,
          workingHours: toWorkingHours(state.startLocal, state.endLocal),
          daysOfWeek: [1, 2, 3, 4, 5, 6],
        },
        scheduledAt,
        status: scheduledAt ? 'scheduled' : 'draft',
      })
      toast('Campaign created')
      navigate(`/campaigns/${campaign.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Create failed')
    }
  }

  return (
    <div>
      <PageHeader
        title="New campaign"
        description="Configure audience, agent, pacing, and retries."
        actions={
          <Button variant="outline" asChild>
            <Link to="/campaigns">Cancel</Link>
          </Button>
        }
      />

      <WizardStepIndicator steps={WIZARD_STEPS} current={step} />

      {stepError ? <p className="mb-4 text-sm text-fail">{stepError}</p> : null}

      {step === 1 ? (
        <section className="max-w-lg space-y-4">
          <Field label="Campaign name">
            <TextInput
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="EMI overdue — Sep cohort"
            />
          </Field>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-3">
          <p className="text-sm text-muted">Select the contact list to dial.</p>
          {listsLoading ? (
            <p className="text-sm text-muted">Loading lists…</p>
          ) : lists.length === 0 ? (
            <div className="border border-line bg-panel px-4 py-6">
              <p className="text-sm text-text">No contact lists available.</p>
              <Button className="mt-3" variant="outline" asChild>
                <Link to="/contacts/upload">Upload contacts</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {lists.map((list) => {
                const disabled = list.status === 'processing'
                const selected = state.contactListId === list.id
                return (
                  <button
                    key={list.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => patch({ contactListId: list.id })}
                    className={cn(
                      'border px-4 py-3 text-left transition-colors',
                      selected ? 'border-text bg-panel' : 'border-line hover:bg-panel',
                      disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <p className="font-medium text-text">{list.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {list.contactCount.toLocaleString('en-IN')} contacts
                      {disabled ? ' · processing' : ''}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-3">
          <p className="text-sm text-muted">Select the voice agent for this campaign.</p>
          {agentsLoading ? (
            <p className="text-sm text-muted">Loading agents…</p>
          ) : activeAgents.length === 0 ? (
            <div className="border border-line bg-panel px-4 py-6">
              <p className="text-sm text-text">No active agents.</p>
              <Button className="mt-3" variant="outline" asChild>
                <Link to="/agents/new">Create agent</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.map((agent) => {
                const selectable = agent.status === 'active'
                const selected = state.agentId === agent.id
                return (
                  <button
                    key={agent.id}
                    type="button"
                    disabled={!selectable}
                    onClick={() => patch({ agentId: agent.id })}
                    className={cn(
                      'border px-4 py-3 text-left transition-colors',
                      selected ? 'border-text bg-panel' : 'border-line hover:bg-panel',
                      !selectable && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <p className="font-medium text-text">{agent.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {agent.llm.model} · {agent.tts.voice}
                      {!selectable ? ` · ${agent.status}` : ''}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field label="Calls per second (1–50)">
            <TextInput
              type="number"
              min={1}
              max={50}
              value={state.targetCps}
              onChange={(e) => patch({ targetCps: Number(e.target.value) })}
            />
          </Field>
          <Field label="Max concurrent calls">
            <TextInput
              type="number"
              min={1}
              value={state.maxConcurrent}
              onChange={(e) => patch({ maxConcurrent: Number(e.target.value) })}
            />
          </Field>
          <Field label="Dial timeout (seconds)">
            <TextInput
              type="number"
              min={1}
              value={state.dialTimeoutSec}
              onChange={(e) => patch({ dialTimeoutSec: Number(e.target.value) })}
            />
          </Field>
          <Field label="Timezone">
            <Select
              value={state.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </Select>
          </Field>
          <Field label="Working hours start">
            <TextInput
              type="time"
              value={state.startLocal}
              onChange={(e) => patch({ startLocal: e.target.value })}
            />
          </Field>
          <Field label="Working hours end">
            <TextInput
              type="time"
              value={state.endLocal}
              onChange={(e) => patch({ endLocal: e.target.value })}
            />
          </Field>
          <Field label="Working hours (HHMM-HHMM)" hint="Derived from start and end times.">
            <TextInput
              readOnly
              value={toWorkingHours(state.startLocal, state.endLocal)}
              className="text-muted"
            />
          </Field>
          <Field label="Optional start time" hint="Leave empty to save as draft.">
            <TextInput
              type="datetime-local"
              value={state.scheduledAt}
              onChange={(e) => patch({ scheduledAt: e.target.value })}
            />
          </Field>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-6">
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Field label="Max attempts">
              <TextInput
                type="number"
                min={1}
                value={state.maxAttempts}
                onChange={(e) => patch({ maxAttempts: Number(e.target.value) })}
              />
            </Field>
            <Field label="Retry delay (minutes)">
              <TextInput
                type="number"
                min={0}
                value={state.retryDelayMinutes}
                onChange={(e) => patch({ retryDelayMinutes: Number(e.target.value) })}
              />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm text-text">Retry on</p>
            <div className="flex flex-wrap gap-3">
              {RETRY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.retryOn.includes(opt.value)}
                    onChange={() => toggleRetryOn(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="border border-line bg-panel px-4 py-4">
            <p className="mb-3 text-sm font-medium text-text">Review</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <ReviewItem label="Name" value={state.name} />
              <ReviewItem label="Contact list" value={selectedList?.name ?? '—'} />
              <ReviewItem
                label="Contacts"
                value={selectedList ? selectedList.contactCount.toLocaleString('en-IN') : '—'}
              />
              <ReviewItem label="Agent" value={selectedAgent?.name ?? '—'} />
              <ReviewItem
                label="Model / voice"
                value={
                  selectedAgent
                    ? `${selectedAgent.llm.model} · ${selectedAgent.tts.voice}`
                    : '—'
                }
              />
              <ReviewItem label="Calls / sec" value={String(state.targetCps)} />
              <ReviewItem label="Max concurrent" value={String(state.maxConcurrent)} />
              <ReviewItem label="Dial timeout" value={`${state.dialTimeoutSec}s`} />
              <ReviewItem
                label="Working hours"
                value={`${toWorkingHours(state.startLocal, state.endLocal)} (${state.timezone})`}
              />
              <ReviewItem
                label="Scheduled start"
                value={state.scheduledAt ? state.scheduledAt.replace('T', ' ') : 'Draft (no schedule)'}
              />
              <ReviewItem label="Max attempts" value={String(state.maxAttempts)} />
              <ReviewItem label="Retry delay" value={`${state.retryDelayMinutes} min`} />
              <ReviewItem label="Retry on" value={state.retryOn.join(', ')} />
            </dl>
          </div>
        </section>
      ) : null}

      <div className="mt-6 flex justify-between gap-2">
        <Button type="button" variant="outline" disabled={step === 1} onClick={goBack}>
          Back
        </Button>
        {step < 5 ? (
          <Button type="button" onClick={goNext}>Next</Button>
        ) : (
          <Button type="button" disabled={create.isPending} onClick={() => void onCreate()}>
            {create.isPending ? 'Creating…' : 'Create campaign'}
          </Button>
        )}
      </div>
    </div>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}
