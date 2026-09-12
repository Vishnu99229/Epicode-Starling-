package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/starling/flock/internal/config"
	"github.com/starling/flock/internal/store"
	"github.com/starling/flock/internal/worker"
)

func main() {
	log.SetFlags(log.LstdFlags)
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("flock: database: %v", err)
	}
	defer db.Close()

	w := worker.New(cfg, db)
	log.Printf(
		"flock: starting dry_run=%v once=%v batch=%d poll=%ds base_url=%s",
		cfg.DryRun,
		cfg.Once,
		cfg.BatchSize,
		cfg.PollIntervalSec,
		cfg.IraVoiceBaseURL,
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
