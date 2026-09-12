package worker

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"github.com/starling/flock/internal/agent"
	"github.com/starling/flock/internal/config"
	"github.com/starling/flock/internal/dialer"
	"github.com/starling/flock/internal/iravoice"
	"github.com/starling/flock/internal/pacing"
	"github.com/starling/flock/internal/store"
	"github.com/starling/flock/internal/window"
)

type Worker struct {
	cfg      config.Config
	store    *store.Store
	client   *iravoice.Client
	limiter  *pacing.Limiter
	slowdown time.Time
}

func New(cfg config.Config, store *store.Store) *Worker {
	return &Worker{
		cfg:     cfg,
		store:   store,
		client:  iravoice.NewClient(cfg.IraVoiceBaseURL, cfg.IraVoiceToken, cfg.EpicodeTenant),
		limiter: pacing.New(2),
	}
}

func (w *Worker) RunOnce(ctx context.Context) error {
	if err := w.reconcileCompleted(ctx); err != nil {
		log.Printf("flock: reconcile completed jobs: %v", err)
	}

	if time.Now().Before(w.slowdown) {
		log.Printf("flock: slowdown pause active until %s", w.slowdown.Format(time.RFC3339))
		return nil
	}

	jobs, err := w.store.ClaimJobs(ctx, w.cfg.BatchSize)
	if err != nil {
		return err
	}
	if len(jobs) == 0 {
		return nil
	}

	var slowdownJobIDs []string
	for index, job := range jobs {
		if !window.InCallingWindow(job.CallingWindow, time.Now()) {
			log.Printf("flock: skip job %s outside calling window", job.ID)
			if err := w.store.ReleaseClaimed(ctx, []string{job.ID}); err != nil {
				log.Printf("flock: release outside window %s: %v", job.ID, err)
			}
			continue
		}

		active, err := w.store.ActiveDialCount(ctx, job.CampaignID)
		if err != nil {
			log.Printf("flock: active dial count %s: %v", job.CampaignID, err)
			slowdownJobIDs = append(slowdownJobIDs, job.ID)
			continue
		}
		if active > job.Pacing.MaxConcurrent {
			log.Printf("flock: skip job %s; campaign %s at max concurrent (%d)", job.ID, job.CampaignID, job.Pacing.MaxConcurrent)
			if err := w.store.ReleaseClaimed(ctx, []string{job.ID}); err != nil {
				log.Printf("flock: release max concurrent %s: %v", job.ID, err)
			}
			continue
		}

		w.limiter.SetTargetCPS(job.Pacing.TargetCPS)
		w.limiter.Wait()

		if err := w.dialJob(ctx, job); err != nil {
			if errors.Is(err, errSlowdown) {
				for _, pending := range jobs[index:] {
					slowdownJobIDs = append(slowdownJobIDs, pending.ID)
				}
				break
			}
		}
	}

	if len(slowdownJobIDs) > 0 {
		if err := w.store.ReleaseClaimed(ctx, slowdownJobIDs); err != nil {
			log.Printf("flock: release slowdown jobs: %v", err)
		}
	}
	return nil
}

var errSlowdown = errors.New("slowdown")

func (w *Worker) dialJob(ctx context.Context, job store.ClaimedJob) error {
	agentSettings := agent.Parse(job.BotcomposeBotID, job.AgentID, job.AgentConfig)
	req, err := dialer.BuildMakecall(job, w.cfg, agentSettings)
	if err != nil {
		log.Printf("flock: build makecall job=%s: %v", job.ID, err)
		return w.handleFailure(ctx, job, true)
	}

	payload, _ := json.MarshalIndent(req, "", "  ")
	if w.cfg.DryRun {
		log.Printf("flock: DRY RUN makecall job=%s\n%s", job.ID, string(payload))
		return w.store.ReleaseClaimed(ctx, []string{job.ID})
	}

	resp, _, err := w.client.Makecall(ctx, req)
	if err != nil {
		log.Printf("flock: makecall job=%s: %v", job.ID, err)
		return w.handleFailure(ctx, job, w.retryableHTTP(resp.HTTPStatus))
	}

	if resp.Slowdown {
		log.Printf("flock: slowdown=true from IraVoice; pausing makecall for 60s (job=%s)", job.ID)
		w.slowdown = time.Now().Add(60 * time.Second)
		return errSlowdown
	}

	if resp.StatusCode != 0 || resp.CallUUID == "" {
		log.Printf("flock: makecall failed job=%s status=%s status_code=%d", job.ID, resp.Status, resp.StatusCode)
		return w.handleFailure(ctx, job, w.retryableHTTP(resp.HTTPStatus))
	}

	if err := w.store.MarkDialing(ctx, job.ID, resp.CallUUID, resp.Cluster); err != nil {
		log.Printf("flock: persist call_uuid job=%s: %v", job.ID, err)
		return err
	}
	log.Printf("flock: dialed job=%s call_uuid=%s cluster=%s", job.ID, resp.CallUUID, resp.Cluster)
	return nil
}

func (w *Worker) handleFailure(ctx context.Context, job store.ClaimedJob, retryable bool) error {
	nextAttempt := job.AttemptNo + 1
	if retryable && nextAttempt <= job.Pacing.MaxAttempts && job.Pacing.RetryAllowed("failed") {
		delay := time.Duration(job.Pacing.RetryDelayMinutes) * time.Minute
		if err := w.store.ScheduleRetry(ctx, job.ID, delay, nextAttempt); err != nil {
			return err
		}
		log.Printf("flock: scheduled retry job=%s attempt=%d at +%dm", job.ID, nextAttempt, job.Pacing.RetryDelayMinutes)
		return nil
	}
	if err := w.store.MarkFailed(ctx, job.ID); err != nil {
		return err
	}
	log.Printf("flock: marked failed job=%s", job.ID)
	return nil
}

func (w *Worker) retryableHTTP(status int) bool {
	switch status {
	case 400, 404, 422, 409:
		return false
	default:
		return true
	}
}

func (w *Worker) reconcileCompleted(ctx context.Context) error {
	jobs, err := w.store.ListCompletedForRetry(ctx, w.cfg.BatchSize)
	if err != nil {
		return err
	}
	for _, job := range jobs {
		nextAttempt := job.AttemptNo + 1
		if nextAttempt <= job.Pacing.MaxAttempts && job.Pacing.RetryAllowed(job.Outcome) {
			delay := time.Duration(job.Pacing.RetryDelayMinutes) * time.Minute
			if err := w.store.ScheduleRetry(ctx, job.JobID, delay, nextAttempt); err != nil {
				return err
			}
			log.Printf("flock: retry scheduled for completed job=%s outcome=%s attempt=%d", job.JobID, job.Outcome, nextAttempt)
			continue
		}
		if err := w.store.MarkDone(ctx, job.JobID); err != nil {
			return err
		}
		log.Printf("flock: marked done job=%s outcome=%s", job.JobID, job.Outcome)
	}
	return nil
}
