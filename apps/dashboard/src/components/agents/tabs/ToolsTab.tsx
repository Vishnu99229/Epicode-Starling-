import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { Field, Select, TextArea, TextInput } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { BUILTIN_TOOLS } from '@/lib/agent-options'
import type { AgentCreate, FunctionTool } from '@/types'

import { Dialog } from '../AgentListRail'
import { Section } from '../Section'

export function ToolsTab() {
  const { setValue, control } = useFormContext<AgentCreate>()
  const tools = useWatch({ control, name: 'tools' }) ?? []
  const [manualOpen, setManualOpen] = useState(false)
  const [curlOpen, setCurlOpen] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    endpoint: '',
    method: 'POST' as FunctionTool['method'],
    params: '',
  })
  const [curl, setCurl] = useState('')

  function addTool(tool: FunctionTool) {
    if (tools.some((t) => t.kind === tool.kind && t.kind !== 'custom')) return
    setValue('tools', [...tools, tool])
  }

  function removeTool(id: string) {
    setValue(
      'tools',
      tools.filter((t) => t.id !== id),
    )
  }

  return (
    <div className="space-y-4">
      <Section title="Function tools">
        <div className="grid gap-2 sm:grid-cols-3">
          {BUILTIN_TOOLS.map((tool) => (
            <div key={tool.kind} className="border border-line bg-ground p-3">
              <div className="text-sm font-medium">{tool.name}</div>
              <p className="mt-1 text-xs text-muted">{tool.description}</p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                variant="outline"
                onClick={() =>
                  addTool({
                    id: crypto.randomUUID(),
                    kind: tool.kind,
                    name: tool.name,
                    description: tool.description,
                  })
                }
              >
                Add
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Custom tool">
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setManualOpen(true)}>
            Write manually
          </Button>
          <Button type="button" variant="outline" onClick={() => setCurlOpen(true)}>
            Generate from cURL
          </Button>
        </div>
      </Section>

      <Section title="Enabled tools">
        {tools.length === 0 ? (
          <p className="text-sm text-muted">No tools enabled.</p>
        ) : (
          <ul className="space-y-2">
            {tools.map((tool) => (
              <li
                key={tool.id}
                className="flex items-center justify-between border border-line px-3 py-2 text-sm"
              >
                <span>
                  {tool.name}
                  <span className="ml-2 text-xs text-muted">{tool.kind}</span>
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeTool(tool.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Dialog open={manualOpen} title="Write custom tool" onClose={() => setManualOpen(false)}>
        <div className="space-y-3">
          <Field label="Name">
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <TextArea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>
          <Field label="Endpoint">
            <TextInput
              value={draft.endpoint}
              onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })}
            />
          </Field>
          <Field label="Method">
            <Select
              value={draft.method}
              onChange={(e) =>
                setDraft({ ...draft, method: e.target.value as FunctionTool['method'] })
              }
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </Select>
          </Field>
          <Field label="Params">
            <TextArea
              rows={3}
              className="font-mono"
              value={draft.params}
              onChange={(e) => setDraft({ ...draft, params: e.target.value })}
            />
          </Field>
          <Button
            type="button"
            onClick={() => {
              addTool({
                id: crypto.randomUUID(),
                kind: 'custom',
                name: draft.name || 'Custom tool',
                description: draft.description,
                endpoint: draft.endpoint,
                method: draft.method,
                params: draft.params,
              })
              setManualOpen(false)
            }}
          >
            Add tool
          </Button>
        </div>
      </Dialog>

      <Dialog open={curlOpen} title="Generate from cURL" onClose={() => setCurlOpen(false)}>
        <Field label="cURL">
          <TextArea
            rows={8}
            className="font-mono"
            value={curl}
            onChange={(e) => setCurl(e.target.value)}
          />
        </Field>
        <Button
          type="button"
          className="mt-3"
          onClick={() => {
            addTool({
              id: crypto.randomUUID(),
              kind: 'custom',
              name: 'Imported cURL tool',
              description: 'Generated from cURL',
              method: 'POST',
              curl,
            })
            setCurlOpen(false)
            setCurl('')
          }}
        >
          Add tool
        </Button>
      </Dialog>
    </div>
  )
}
