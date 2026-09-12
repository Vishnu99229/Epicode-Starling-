package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/starling/ledger/internal/iravoice"
)

type Store struct {
	pool *pgxpool.Pool
}

type LedgerRow struct {
	CallUUID    string
	CampaignID  string
	ContactID   string
	DialJobID   string
	Cluster     string
	State       string
	CPAEvent    string
	FromNumber  string
	ToNumber    string
	StartedAt   *time.Time
	AnsweredAt  *time.Time
	EndedAt     *time.Time
	DurationSec *float64
	HangupCause string
	RawEvents   json.RawMessage
	UpdatedAt   time.Time
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

func (s *Store) UpsertIraVoiceEvent(
	ctx context.Context,
	raw json.RawMessage,
	eventName string,
	fields iravoice.EventFields,
) error {
	if fields.CallUUID == "" {
		return errors.New("missing call_uuid")
	}
	if fields.CampaignID == "" || fields.ContactID == "" || fields.ToNumber == "" {
		return fmt.Errorf(
			"cannot create call_ledger row for %s: need campaign_id, contact_id, and to_number in event_data.call_params / event_data",
			fields.CallUUID,
		)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	current, found, err := getLedgerRow(ctx, tx, fields.CallUUID)
	if err != nil {
		return err
	}

	next := mergeLedgerUpdate(current, found, fields, eventName)
	eventArray, err := json.Marshal([]json.RawMessage{raw})
	if err != nil {
		return err
	}

	if !found {
		_, err = tx.Exec(ctx, `
			INSERT INTO call_ledger (
				call_uuid, campaign_id, contact_id, dial_job_id, cluster, state,
				cpa_event, from_number, to_number, started_at, answered_at, ended_at,
				duration_sec, hangup_cause, raw_events, updated_at
			) VALUES (
				$1, $2::uuid, $3::uuid, NULLIF($4, '')::uuid, NULLIF($5, ''), $6,
				NULLIF($7, ''), NULLIF($8, ''), $9, $10, $11, $12,
				$13, NULLIF($14, ''), $15::jsonb, now()
			)`,
			fields.CallUUID,
			fields.CampaignID,
			fields.ContactID,
			fields.DialJobID,
			next.Cluster,
			next.State,
			next.CPAEvent,
			next.FromNumber,
			next.ToNumber,
			next.StartedAt,
			next.AnsweredAt,
			next.EndedAt,
			next.DurationSec,
			next.HangupCause,
			eventArray,
		)
		if err != nil {
			return err
		}
		return tx.Commit(ctx)
	}

	_, err = tx.Exec(ctx, `
		UPDATE call_ledger SET
			campaign_id = COALESCE($2::uuid, campaign_id),
			contact_id = COALESCE($3::uuid, contact_id),
			dial_job_id = COALESCE(NULLIF($4, '')::uuid, dial_job_id),
			cluster = COALESCE(NULLIF($5, ''), cluster),
			state = $6,
			cpa_event = COALESCE(NULLIF($7, ''), cpa_event),
			from_number = COALESCE(NULLIF($8, ''), from_number),
			to_number = COALESCE(NULLIF($9, ''), to_number),
			started_at = COALESCE($10, started_at),
			answered_at = COALESCE($11, answered_at),
			ended_at = COALESCE($12, ended_at),
			duration_sec = COALESCE($13, duration_sec),
			hangup_cause = COALESCE(NULLIF($14, ''), hangup_cause),
			raw_events = raw_events || $15::jsonb,
			updated_at = now()
		WHERE call_uuid = $1`,
		fields.CallUUID,
		nullUUID(fields.CampaignID),
		nullUUID(fields.ContactID),
		fields.DialJobID,
		next.Cluster,
		next.State,
		next.CPAEvent,
		next.FromNumber,
		next.ToNumber,
		next.StartedAt,
		next.AnsweredAt,
		next.EndedAt,
		next.DurationSec,
		next.HangupCause,
		eventArray,
	)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) UpsertCDR(
	ctx context.Context,
	callUUID string,
	transcript json.RawMessage,
	latency json.RawMessage,
	usage json.RawMessage,
) error {
	if callUUID == "" {
		return errors.New("missing call_uuid")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO cdrs (call_uuid, transcript, latency_metrics, usage)
		VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
		ON CONFLICT (call_uuid) DO UPDATE SET
			transcript = COALESCE(EXCLUDED.transcript, cdrs.transcript),
			latency_metrics = COALESCE(EXCLUDED.latency_metrics, cdrs.latency_metrics),
			usage = COALESCE(EXCLUDED.usage, cdrs.usage),
			received_at = now()`,
		callUUID,
		nullJSON(transcript),
		nullJSON(latency),
		nullJSON(usage),
	)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		UPDATE call_ledger
		SET state = 'analyzed', updated_at = now()
		WHERE call_uuid = $1 AND state = 'completed'`,
		callUUID,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *Store) GetLedger(ctx context.Context, callUUID string) (*LedgerRow, error) {
	row, found, err := getLedgerRow(ctx, s.pool, callUUID)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return &row, nil
}

type ledgerUpdate struct {
	State       string
	Cluster     string
	CPAEvent    string
	FromNumber  string
	ToNumber    string
	StartedAt   *time.Time
	AnsweredAt  *time.Time
	EndedAt     *time.Time
	DurationSec *float64
	HangupCause string
}

func mergeLedgerUpdate(
	current LedgerRow,
	found bool,
	fields iravoice.EventFields,
	eventName string,
) ledgerUpdate {
	next := ledgerUpdate{
		State:       "queued",
		Cluster:     fields.Cluster,
		CPAEvent:    fields.CPAEvent,
		FromNumber:  fields.FromNumber,
		ToNumber:    fields.ToNumber,
		HangupCause: fields.HangupCause,
		DurationSec: fields.DurationSec,
	}
	if found {
		next.State = current.State
		if current.Cluster != "" {
			next.Cluster = current.Cluster
		}
		if current.FromNumber != "" {
			next.FromNumber = current.FromNumber
		}
		if current.ToNumber != "" {
			next.ToNumber = current.ToNumber
		}
	}

	if fields.AdvanceState && iravoice.ShouldAdvanceState(next.State, fields.State) {
		next.State = fields.State
	}

	if fields.EventTime != nil {
		switch eventName {
		case "iravoice::started":
			next.StartedAt = fields.EventTime
		case "iravoice::answered":
			next.AnsweredAt = fields.EventTime
		case "iravoice::hangup":
			next.EndedAt = fields.EventTime
		}
	}

	if found {
		if next.StartedAt == nil {
			next.StartedAt = current.StartedAt
		}
		if next.AnsweredAt == nil {
			next.AnsweredAt = current.AnsweredAt
		}
		if next.EndedAt == nil {
			next.EndedAt = current.EndedAt
		}
		if next.DurationSec == nil {
			next.DurationSec = current.DurationSec
		}
		if next.CPAEvent == "" {
			next.CPAEvent = current.CPAEvent
		}
		if next.HangupCause == "" {
			next.HangupCause = current.HangupCause
		}
	}

	return next
}

type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func getLedgerRow(ctx context.Context, q rowQuerier, callUUID string) (LedgerRow, bool, error) {
	var row LedgerRow
	err := q.QueryRow(ctx, `
		SELECT call_uuid, campaign_id::text, contact_id::text, COALESCE(dial_job_id::text, ''),
			COALESCE(cluster, ''), state::text, COALESCE(cpa_event, ''),
			COALESCE(from_number, ''), to_number, started_at, answered_at, ended_at,
			duration_sec, COALESCE(hangup_cause, ''), raw_events, updated_at
		FROM call_ledger
		WHERE call_uuid = $1`,
		callUUID,
	).Scan(
		&row.CallUUID,
		&row.CampaignID,
		&row.ContactID,
		&row.DialJobID,
		&row.Cluster,
		&row.State,
		&row.CPAEvent,
		&row.FromNumber,
		&row.ToNumber,
		&row.StartedAt,
		&row.AnsweredAt,
		&row.EndedAt,
		&row.DurationSec,
		&row.HangupCause,
		&row.RawEvents,
		&row.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return LedgerRow{}, false, nil
	}
	if err != nil {
		return LedgerRow{}, false, err
	}
	return row, true, nil
}

func nullUUID(value string) interface{} {
	if value == "" {
		return nil
	}
	return value
}

func nullJSON(value json.RawMessage) interface{} {
	if len(value) == 0 {
		return nil
	}
	return value
}
