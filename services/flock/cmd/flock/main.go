package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/starling/flock/internal/config"
	"github.com/starling/flock/internal/store"
	"github.com/starling/flock/internal/worker"
)

func main() {
	log.SetFlags(log.LstdFlags)
	cfg := config.Load()

	if !cfg.DryRun {
		if strings.TrimSpace(cfg.IraVoiceBaseURL) == "" || strings.TrimSpace(cfg.IraVoiceToken) == "" {
			log.Fatal("flock: IRAVOICE_BASE_URL and IRAVOICE_BEARER_TOKEN are required when FLOCK_DRY_RUN is false")
		}
	}

	preflightLedger(cfg.EventURLBase)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("flock: database: %v", err)
	}
	defer db.Close()

	w := worker.New(cfg, db)
	log.Printf(
		"flock: starting dry_run=%v once=%v batch=%d poll=%ds base_url=%s event_url_base=%s",
		cfg.DryRun,
		cfg.Once,
		cfg.BatchSize,
		cfg.PollIntervalSec,
		cfg.IraVoiceBaseURL,
		cfg.EventURLBase,
	)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(time.Duration(cfg.PollIntervalSec) * time.Second)
	defer ticker.Stop()

	run := func() {
		if err := w.RunOnce(context.Background()); err != nil {
			log.Printf("flock: loop error: %v", err)
		}
	}

	run()
	if cfg.Once {
		return
	}

	for {
		select {
		case <-ticker.C:
			run()
		case <-stop:
			log.Println("flock: stopped")
			return
		}
	}
}

func preflightLedger(eventURLBase string) {
	base := strings.TrimRight(strings.TrimSpace(eventURLBase), "/")
	if base == "" {
		log.Printf("flock: WARNING: EVENT_URL_BASE is empty — IraVoice events will not be received")
		return
	}

	url := base + "/healthz"
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Printf(
			"flock: WARNING: Ledger health check failed for %s (%v) — IraVoice events will not be received",
			url,
			err,
		)
		return
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf(
			"flock: WARNING: Ledger health check returned %d for %s — IraVoice events will not be received",
			resp.StatusCode,
			url,
		)
		return
	}

	log.Printf("flock: Ledger reachable at %s", base)
}
