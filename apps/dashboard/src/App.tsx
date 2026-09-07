import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'
import { AgentBuilderPage } from '@/pages/AgentBuilderPage'
import { AgentsPage } from '@/pages/AgentsPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { CallLogsPage } from '@/pages/CallLogsPage'
import { CampaignDetailPage } from '@/pages/CampaignDetailPage'
import { CampaignWizardPage } from '@/pages/CampaignWizardPage'
import { CampaignsPage } from '@/pages/CampaignsPage'
import { ContactListDetailPage } from '@/pages/ContactListDetailPage'
import { ContactUploadPage } from '@/pages/ContactUploadPage'
import { ContactsPage } from '@/pages/ContactsPage'

function withBoundary(name: string, element: React.ReactNode) {
  return <RouteErrorBoundary routeName={name}>{element}</RouteErrorBoundary>
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/agents" replace />} />
        <Route path="agents" element={withBoundary('agents', <AgentsPage />)} />
        <Route path="agents/new" element={withBoundary('agents-new', <AgentBuilderPage />)} />
        <Route path="agents/:id" element={withBoundary('agents-detail', <AgentBuilderPage />)} />
        <Route path="contacts" element={withBoundary('contacts', <ContactsPage />)} />
        <Route path="contacts/upload" element={withBoundary('contacts-upload', <ContactUploadPage />)} />
        <Route path="contacts/:id" element={withBoundary('contacts-detail', <ContactListDetailPage />)} />
        <Route path="campaigns" element={withBoundary('campaigns', <CampaignsPage />)} />
        <Route path="campaigns/new" element={withBoundary('campaigns-new', <CampaignWizardPage />)} />
        <Route path="campaigns/:id" element={withBoundary('campaigns-detail', <CampaignDetailPage />)} />
        <Route path="analytics" element={withBoundary('analytics', <AnalyticsPage />)} />
        <Route path="analytics/calls" element={withBoundary('analytics-calls', <CallLogsPage />)} />
      </Route>
    </Routes>
  )
}
