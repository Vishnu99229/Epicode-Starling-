package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/starling/flock/internal/campaign"
)

type Store struct {
	pool *pgxpool.Pool
}

type ClaimedJob struct {
	ID                   string
	CampaignID           string
	ContactID            string
	AttemptNo            int
	PhoneNumber          string
	ContactName          string
	ContactAttributes    map[string]string
	IraVoiceCampaignName string
	Pacing               campaign.Pacing
	CallingWindow        campaign.CallingWindow
	AgentID              string
	BotcomposeBotID      string
	AgentConfig          json.RawMessage
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

// ClaimJobsSQL is the SELECT ... FOR UPDATE SKIP LOCKED claim used by Flock.
const ClaimJobsSQL = `
WITH picked AS (
  SELECT dj.id
  FROM dial_jobs dj
  INNER JOIN campaigns c ON c.id = dj.campaign_id
  WHERE dj.state = 'pending'
    AND (dj.next_attempt_at IS NULL OR dj.next_attempt_at <= now())
    AND c.status = 'running'
  ORDER BY dj.next_attempt_at NULLS FIRST, dj.created_at
  LIMIT $1
  FOR UPDATE OF dj SKIP LOCKED
)
UPDATE dial_jobs dj
SET state = 'claimed',
    claimed_at = now()
FROM picked
WHERE dj.id = picked.id
RETURNING dj.id, dj.campaign_id::text, dj.contact_id::text, dj.attempt_no
`

func (s *Store) ClaimJobs(ctx context.Context, limit int) ([]ClaimedJob, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, ClaimJobsSQL, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type claimedID struct {
		id, campaignID, contactID string
		attemptNo                 int
	}
	var claimed []claimedID
	for rows.Next() {
		var item claimedID
		if err := rows.Scan(&item.id, &item.campaignID, &item.contactID, &item.attemptNo); err != nil {
			return nil, err
		}
		claimed = append(claimed, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(claimed) == 0 {
		return nil, tx.Commit(ctx)
	}

	jobs := make([]ClaimedJob, 0, len(claimed))
	for _, item := range claimed {
		job, err := loadClaimedJob(ctx, tx, item.id)
		if err != nil {
			return nil, err
		}
		job.AttemptNo = item.attemptNo
		jobs = append(jobs, job)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return jobs, nil
}

func loadClaimedJob(ctx context.Context, tx pgx.Tx, jobID string) (ClaimedJob, error) {
	const sql = `
		SELECT
			dj.id::text,
			dj.campaign_id::text,
			dj.contact_id::text,
			dj.attempt_no,
			COALESCE(c.iravoice_campaign_name, ''),
			c.pacing,
			c.calling_window,
			COALESCE(c.agent_id::text, ''),
			COALESCE(a.botcompose_bot_id, ''),
			COALESCE(a.config, '{}'::jsonb),
			ct.phone_number,
			COALESCE(ct.name, ''),
			COALESCE(ct.attributes, '{}'::jsonb)
		FROM dial_jobs dj
		INNER JOIN campaigns c ON c.id = dj.campaign_id
		INNER JOIN contacts ct ON ct.id = dj.contact_id
		LEFT JOIN agents a ON a.id = c.agent_id
		WHERE dj.id = $1::uuid
	`
	var job ClaimedJob
	var attrs json.RawMessage
	var pacingRaw json.RawMessage
	var windowRaw json.RawMessage
	if err := tx.QueryRow(ctx, sql, jobID).Scan(
		&job.ID,
		&job.CampaignID,
		&job.ContactID,
		&job.AttemptNo,
		&job.IraVoiceCampaignName,
		&pacingRaw,
		&windowRaw,
		&job.AgentID,
		&job.BotcomposeBotID,
		&job.AgentConfig,
		&job.PhoneNumber,
		&job.ContactName,
		&attrs,
	); err != nil {
		return ClaimedJob{}, err
	}
	job.Pacing = campaign.ParsePacing(pacingRaw)
	job.CallingWindow = campaign.ParseCallingWindow(windowRaw)
	job.ContactAttributes = decodeStringMap(attrs)
	return job, nil
}

func decodeStringMap(raw json.RawMessage) map[string]string {
	out := map[string]string{}
	if len(raw) == 0 {
		return out
	}
	var generic map[string]interface{}
	if err := json.Unmarshal(raw, &generic); err != nil {
		return out
	}
	for key, value := range generic {
		switch typed := value.(type) {
		case string:
			out[key] = typed
		case float64:
			out[key] = fmt.Sprintf("%v", typed)
		case bool:
			out[key] = fmt.Sprintf("%v", typed)
		default:
			b, _ := json.Marshal(typed)
			out[key] = string(b)
		}
	}
	return out
}

func (s *Store) ReleaseClaimed(ctx context.Context, jobIDs []string) error {
	if len(jobIDs) == 0 {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE dial_jobs
		SET state = 'pending', claimed_at = NULL
		WHERE id = ANY($1::uuid[]) AND state = 'claimed'`,
		jobIDs,
	)
	return err
}

func (s *Store) MarkDialing(ctx context.Context, jobID, callUUID, cluster string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var campaignID, contactID, phone string
	err = tx.QueryRow(ctx, `
		UPDATE dial_jobs
		SET state = 'dialing', call_uuid = $2
		WHERE id = $1::uuid
		RETURNING campaign_id::text, contact_id::text`,
		jobID, callUUID,
	).Scan(&campaignID, &contactID)
	if err != nil {
		return err
	}

	err = tx.QueryRow(ctx, `
		SELECT phone_number FROM contacts WHERE id = $1::uuid`, contactID,
	).Scan(&phone)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO call_ledger (
			call_uuid, campaign_id, contact_id, dial_job_id, cluster, state, to_number, raw_events
		) VALUES (
			$1, $2::uuid, $3::uuid, $4::uuid, $5, 'dialing', $6, '[]'::jsonb
		)
		ON CONFLICT (call_uuid) DO UPDATE SET
			cluster = COALESCE(EXCLUDED.cluster, call_ledger.cluster),
			dial_job_id = COALESCE(EXCLUDED.dial_job_id, call_ledger.dial_job_id),
			state = CASE
				WHEN call_ledger.state = 'queued' THEN 'dialing'
				ELSE call_ledger.state
			END,
			updated_at = now()`,
		callUUID, campaignID, contactID, jobID, cluster, phone,
	)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) ScheduleRetry(ctx context.Context, jobID string, delay time.Duration, nextAttempt int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE dial_jobs
		SET state = 'pending',
		    attempt_no = $2,
		    next_attempt_at = now() + $3::interval,
		    claimed_at = NULL,
		    call_uuid = NULL
		WHERE id = $1::uuid`,
		jobID, nextAttempt, fmt.Sprintf("%d seconds", int(delay.Seconds())),
	)
	return err
}

func (s *Store) MarkDone(ctx context.Context, jobID string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE dial_jobs SET state = 'done', claimed_at = NULL WHERE id = $1::uuid`, jobID)
	return err
}

func (s *Store) MarkFailed(ctx context.Context, jobID string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE dial_jobs SET state = 'failed', claimed_at = NULL WHERE id = $1::uuid`, jobID)
	return err
}

func (s *Store) ActiveDialCount(ctx context.Context, campaignID string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM dial_jobs
		WHERE campaign_id = $1::uuid
		  AND state IN ('claimed', 'dialing')`,
		campaignID,
	).Scan(&count)
	return count, err
}

type CompletedJob struct {
	JobID     string
	AttemptNo int
	Pacing    campaign.Pacing
	Outcome   string
}

func (s *Store) ListCompletedForRetry(ctx context.Context, limit int) ([]CompletedJob, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT dj.id::text, dj.attempt_no, c.pacing, COALESCE(cl.hangup_cause, ''), COALESCE(cl.cpa_event, '')
		FROM dial_jobs dj
		INNER JOIN campaigns c ON c.id = dj.campaign_id
		INNER JOIN call_ledger cl ON cl.call_uuid = dj.call_uuid
		WHERE dj.state = 'dialing'
		  AND cl.state IN ('completed', 'analyzed')
		ORDER BY cl.updated_at
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []CompletedJob
	for rows.Next() {
		var job CompletedJob
		var pacingRaw json.RawMessage
		var hangupCause, cpaEvent string
		if err := rows.Scan(&job.JobID, &job.AttemptNo, &pacingRaw, &hangupCause, &cpaEvent); err != nil {
			return nil, err
		}
		job.Pacing = campaign.ParsePacing(pacingRaw)
		job.Outcome = classifyOutcome(hangupCause, cpaEvent)
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func classifyOutcome(hangupCause, cpaEvent string) string {
	value := strings.ToLower(hangupCause)
	switch {
	case strings.Contains(value, "busy"):
		return "busy"
	case strings.Contains(value, "no_answer") || strings.Contains(value, "no answer"):
		return "no_answer"
	case strings.EqualFold(cpaEvent, "AM"):
		return "no_answer"
	case hangupCause == "" && cpaEvent == "":
		return "failed"
	default:
		return "completed"
	}
}
