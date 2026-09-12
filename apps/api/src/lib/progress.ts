import type { DbQueryable } from '../db.js'
import type { CampaignProgress } from '../mappers/campaigns.js'

export async function computeCampaignProgress(
  db: DbQueryable,
  campaignId: string,
  contactListId: string | null,
): Promise<CampaignProgress> {
  const jobs = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE state != 'pending')::int AS attempted,
       COUNT(*) FILTER (WHERE state = 'failed')::int AS failed_jobs
     FROM dial_jobs
     WHERE campaign_id = $1::uuid`,
    [campaignId],
  )

  const ledger = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::int AS connected,
       COUNT(*) FILTER (WHERE state IN ('completed', 'analyzed'))::int AS completed
     FROM call_ledger
     WHERE campaign_id = $1::uuid`,
    [campaignId],
  )

  let skipped = 0
  let contactTotal = 0
  if (contactListId) {
    const contactCounts = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE row_status != 'valid')::int AS skipped
       FROM contacts
       WHERE list_id = $1::uuid`,
      [contactListId],
    )
    contactTotal = Number(contactCounts.rows[0]?.total ?? 0)
    skipped = Number(contactCounts.rows[0]?.skipped ?? 0)
  }

  const jobRow = jobs.rows[0] ?? {}
  const ledgerRow = ledger.rows[0] ?? {}

  const jobTotal = Number(jobRow.total ?? 0)
  const total = jobTotal > 0 ? jobTotal + skipped : contactTotal
  const attempted = Number(jobRow.attempted ?? 0)
  const connected = Number(ledgerRow.connected ?? 0)
  const completed = Number(ledgerRow.completed ?? 0)
  const failedJobs = Number(jobRow.failed_jobs ?? 0)
  const failed = Math.max(failedJobs, attempted - connected)

  return {
    total,
    attempted,
    connected,
    completed,
    failed,
    skipped,
  }
}
