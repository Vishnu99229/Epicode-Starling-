package handler

import (
	"context"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/starling/ledger/internal/cdr"
	"github.com/starling/ledger/internal/iravoice"
	"github.com/starling/ledger/internal/store"
)

type Handler struct {
	store *store.Store
}

func New(store *store.Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) Healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"ok":true,"service":"ledger"}`))
}

func (h *Handler) IraVoice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("iravoice webhook: read body: %v", err)
	}
	h.writeOK(w)

	if len(body) == 0 {
		return
	}

	go h.processIraVoice(body)
}

func (h *Handler) BotComposeCDR(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("botcompose-cdr webhook: read body: %v", err)
	}
	h.writeOK(w)

	if len(body) == 0 {
		return
	}

	go h.processCDR(body)
}

func (h *Handler) writeOK(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"ok":true}`))
}

func (h *Handler) processIraVoice(body []byte) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	parsed, err := iravoice.Parse(body)
	if err != nil {
		log.Printf("iravoice webhook: parse json: %v", err)
		return
	}

	if parsed.CallUUID == "" {
		log.Printf("iravoice webhook: missing call_uuid; body=%s", truncate(body, 512))
		return
	}

	fields := iravoice.ExtractFields(parsed.EventName, parsed.EventData)
	if fields.CallUUID == "" {
		fields.CallUUID = parsed.CallUUID
	}

	if err := h.store.UpsertIraVoiceEvent(ctx, parsed.Raw, parsed.EventName, fields); err != nil {
		log.Printf("iravoice webhook: upsert call_uuid=%s event=%s: %v", parsed.CallUUID, parsed.EventName, err)
		return
	}

	log.Printf("iravoice webhook: stored call_uuid=%s event=%s state=%s", parsed.CallUUID, parsed.EventName, fields.State)
}

func (h *Handler) processCDR(body []byte) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	parsed, err := cdr.Parse(body)
	if err != nil {
		log.Printf("botcompose-cdr webhook: parse json: %v", err)
		return
	}

	if parsed.CallUUID == "" {
		log.Printf("botcompose-cdr webhook: missing call_uuid; body=%s", truncate(body, 512))
		return
	}

	if err := h.store.UpsertCDR(ctx, parsed.CallUUID, parsed.Transcript, parsed.LatencyMetrics, parsed.UsageMetrics); err != nil {
		log.Printf("botcompose-cdr webhook: upsert call_uuid=%s: %v", parsed.CallUUID, err)
		return
	}

	log.Printf("botcompose-cdr webhook: stored call_uuid=%s", parsed.CallUUID)
}

func truncate(body []byte, max int) string {
	if len(body) <= max {
		return string(body)
	}
	return string(body[:max]) + "..."
}
