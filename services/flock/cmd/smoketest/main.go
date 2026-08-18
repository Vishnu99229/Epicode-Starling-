package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const botID = "starling_smoke_test"

type config struct {
	botComposeBaseURL   string
	iravoiceMakecallURL string
	tenant              string
	campaign            string
	botComposeToken     string
	iravoiceToken       string
	deepgramKey         string
	groqKey             string
	sarvamKey           string
	eventURL            string
	webhookPort         string
	testToNumber        string
	smokeLive           bool
	addSecrets          bool
}

func main() {
	log.SetFlags(log.LstdFlags)
	cfg := loadConfig()

	log.Println("[smoke] Starling Phase 0 smoke test")
	log.Printf("[smoke] tenant=%s campaign=%s smoke_live=%v add_secrets=%v", cfg.tenant, cfg.campaign, cfg.smokeLive, cfg.addSecrets)

	require(cfg.botComposeBaseURL != "", "BOTCOMPOSE_BASE_URL")
	require(cfg.botComposeToken != "" && cfg.botComposeToken != "FILL_IN", "BOTCOMPOSE_BEARER_TOKEN")

	client := newHTTPClient()

	if cfg.addSecrets {
		runAddSecrets(client, cfg)
	} else {
		log.Println("[step-1] add_secret skipped (ADD_SECRETS not true)")
	}

	runAddBot(client, cfg)
	runGetBot(client, cfg)

	webhook := startWebhookServer(cfg.webhookPort)
	defer webhook.shutdown()

	if cfg.smokeLive {
		require(cfg.iravoiceToken != "" && cfg.iravoiceToken != "FILL_IN", "IRAVOICE_BEARER_TOKEN")
		runMakecall(client, cfg)
		log.Println("[step-5] makecall sent — collecting webhook POSTs for 60s")
	} else {
		log.Println("[step-5] makecall skipped (SMOKE_LIVE not true)")
		if cfg.eventURL == "" || cfg.eventURL == "FILL_IN" {
			log.Println("[step-5] hint: set EVENT_URL when SMOKE_LIVE=true (tunnel or same-network IP)")
		}
		log.Println("[smoke] dry mode: webhook server listening; set SMOKE_LIVE=true for live makecall")
	}

	wait := 60 * time.Second
	log.Printf("[smoke] waiting %s for webhook POSTs on :%s ...", wait, cfg.webhookPort)
	time.Sleep(wait)

	log.Printf("[smoke] done — received %d webhook POST(s)", webhook.count())
}

func loadConfig() config {
	return config{
		botComposeBaseURL:   strings.TrimRight(env("BOTCOMPOSE_BASE_URL", ""), "/"),
		iravoiceMakecallURL: env("IRAVOICE_MAKECALL_URL", ""),
		tenant:              env("EPICODE_TENANT", "copter"),
		campaign:            env("EPICODE_CAMPAIGN", "csdemo2"),
		botComposeToken:     env("BOTCOMPOSE_BEARER_TOKEN", ""),
		iravoiceToken:       env("IRAVOICE_BEARER_TOKEN", ""),
		deepgramKey:         env("DEEPGRAM_API_KEY", ""),
		groqKey:             env("GROQ_API_KEY", ""),
		sarvamKey:           env("SARVAM_API_KEY", ""),
		eventURL:            env("EVENT_URL", ""),
		webhookPort:         env("WEBHOOK_PORT", "8080"),
		testToNumber:        env("TEST_TO_NUMBER", ""),
		smokeLive:           envBool("SMOKE_LIVE", false),
		addSecrets:          envBool("ADD_SECRETS", false),
	}
}

func newHTTPClient() *http.Client {
	// TODO: plug in mTLS client cert + key from secrets/ once received from Epicode.
	// TODO: vishnu_test.pem passphrase handling if API calls require manual unlock.
	return &http.Client{Timeout: 60 * time.Second}
}

func runAddSecrets(client *http.Client, cfg config) {
	log.Println("[step-1] add_secret (ADD_SECRETS=true)")
	secrets := []struct {
		name    string
		content string
	}{
		{name: "deepgram", content: cfg.deepgramKey},
		{name: "groq", content: cfg.groqKey},
		{name: "sarvam", content: cfg.sarvamKey},
	}
	for _, s := range secrets {
		if s.content == "" || s.content == "FILL_IN" {
			log.Printf("[step-1] skip add_secret name=%s (no key in env)", s.name)
			continue
		}
		body, _ := json.Marshal(map[string]string{
			"name":    s.name,
			"type":    "token",
			"content": s.content,
		})
		url := fmt.Sprintf("%s/add_secret?tenant_id=%s", cfg.botComposeBaseURL, cfg.tenant)
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
		if err != nil {
			log.Fatalf("[step-1] add_secret %s: build request: %v", s.name, err)
		}
		setBotComposeHeaders(req, cfg)
		resp, err := client.Do(req)
		if err != nil {
			log.Fatalf("[step-1] add_secret %s: %v", s.name, err)
		}
		logResponse("[step-1]", fmt.Sprintf("add_secret/%s", s.name), resp)
	}
}

func runAddBot(client *http.Client, cfg config) {
	log.Println("[step-2] add_bot")
	body, err := json.Marshal(addBotPayload())
	if err != nil {
		log.Fatalf("[step-2] marshal payload: %v", err)
	}
	url := fmt.Sprintf("%s/add_bot?tenant_id=%s", cfg.botComposeBaseURL, cfg.tenant)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		log.Fatalf("[step-2] build request: %v", err)
	}
	setBotComposeHeaders(req, cfg)
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("[step-2] add_bot: %v", err)
	}
	logResponse("[step-2]", "add_bot", resp)
}

func runGetBot(client *http.Client, cfg config) {
	log.Println("[step-3] get_bot")
	url := fmt.Sprintf("%s/get_bot?tenant_id=%s&bot_id=%s", cfg.botComposeBaseURL, cfg.tenant, botID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		log.Fatalf("[step-3] build request: %v", err)
	}
	setBotComposeHeaders(req, cfg)
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("[step-3] get_bot: %v", err)
	}
	logResponse("[step-3]", "get_bot", resp)
}

type makecallResponse struct {
	CallUUID   string `json:"call_uuid"`
	Cluster    string `json:"cluster"`
	Slowdown   bool   `json:"slowdown"`
	Status     string `json:"status"`
	StatusCode int    `json:"status_code"`
}

func runMakecall(client *http.Client, cfg config) {
	log.Println("[step-5] makecall (SMOKE_LIVE=true)")
	require(cfg.iravoiceMakecallURL != "", "IRAVOICE_MAKECALL_URL")
	require(cfg.testToNumber != "" && cfg.testToNumber != "FILL_IN", "TEST_TO_NUMBER")
	require(cfg.eventURL != "" && cfg.eventURL != "FILL_IN", "EVENT_URL")
	require(cfg.campaign != "", "EPICODE_CAMPAIGN")

	payload := map[string]any{
		"campaign_name": cfg.campaign,
		"to_number":     cfg.testToNumber,
		"call_params": map[string]any{
			"bot_id":            botID,
			"event_url":         cfg.eventURL,
			"macros":            map[string]string{},
			"disable_recording": false,
		},
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, cfg.iravoiceMakecallURL, bytes.NewReader(body))
	if err != nil {
		log.Fatalf("[step-5] build request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+cfg.iravoiceToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("tenant-id", cfg.tenant)

	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("[step-5] makecall: %v", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	log.Printf("[step-5] makecall HTTP %d", resp.StatusCode)
	prettyPrint("[step-5] makecall response", raw)

	var mc makecallResponse
	if err := json.Unmarshal(raw, &mc); err == nil {
		log.Printf("[step-5] call_uuid=%q cluster=%q slowdown=%v status=%q status_code=%d",
			mc.CallUUID, mc.Cluster, mc.Slowdown, mc.Status, mc.StatusCode)
		if mc.Slowdown {
			log.Println("[step-5] slowdown=true — originator must pause makecall 60s")
		}
	}
}

type webhookServer struct {
	server *http.Server
	mu     sync.Mutex
	posts  int
}

func startWebhookServer(port string) *webhookServer {
	w := &webhookServer{}
	mux := http.NewServeMux()
	mux.HandleFunc("/", w.handlePost)
	mux.HandleFunc("/webhook", w.handlePost)

	w.server = &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("[step-4] webhook server listening on :%s (POST / or /webhook)", port)
		if err := w.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[step-4] webhook server: %v", err)
		}
	}()
	return w
}

func (w *webhookServer) handlePost(rw http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(rw, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(rw, "read body", http.StatusBadRequest)
		return
	}
	w.mu.Lock()
	w.posts++
	n := w.posts
	w.mu.Unlock()

	log.Printf("[step-4] webhook POST #%d %s %s", n, r.Method, r.URL.Path)
	prettyPrint("[step-4] webhook body", body)
	rw.WriteHeader(http.StatusOK)
	_, _ = rw.Write([]byte(`{"ok":true}`))
}

func (w *webhookServer) count() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.posts
}

func (w *webhookServer) shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = w.server.Shutdown(ctx)
}

func addBotPayload() map[string]any {
	return map[string]any{
		"bot_id": botID,
		"welcome_message": map[string]string{
			"sentence": "Hello, this is a Starling test call.",
			"language": "en-IN",
		},
		"stt_config": map[string]any{
			"plugin_name": "deepgram_streaming",
			"secret_name": "deepgram",
			"plugin_data": map[string]any{
				"model":              "nova-3",
				"language":           "en-IN",
				"transcript_timeout": 1.5,
			},
		},
		"llm_config": map[string]any{
			"plugin_name": "openai_chat_completions",
			"secret_name": "groq",
			"plugin_data": map[string]any{
				"base_url":         "https://api.groq.com/openai/v1",
				"model":            "qwen/qwen3.6-27b",
				"reasoning_effort": "low",
				"instructions":     "You are a test bot for the Starling smoke test. When the call connects, say a short greeting, then ask the caller to say a few words to confirm two-way audio, then thank them and end. Keep every response under 2 sentences. Begin each turn after the greeting with a one-word acknowledgment such as 'Okay.' or 'Got it.'",
			},
		},
		"builtin_tools": []string{"end_conversation"},
		"tts_config": map[string]any{
			"plugin_name": "sarvam",
			"secret_name": "sarvam",
			"plugin_data": map[string]any{
				"model":    "bulbul:v3",
				"voice":    "kabir",
				"language": "en-IN",
				"pace":     1.1,
			},
		},
		"update_cache": true,
	}
}

func setBotComposeHeaders(req *http.Request, cfg config) {
	req.Header.Set("tenant-id", cfg.tenant)
	req.Header.Set("Authorization", "Bearer "+cfg.botComposeToken)
	req.Header.Set("Content-Type", "application/json")
}

func logResponse(prefix, label string, resp *http.Response) {
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	log.Printf("%s %s HTTP %d", prefix, label, resp.StatusCode)
	prettyPrint(prefix+" "+label, raw)
}

func prettyPrint(label string, raw []byte) {
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		log.Printf("%s (raw): %s", label, string(raw))
		return
	}
	out, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		log.Printf("%s (raw): %s", label, string(raw))
		return
	}
	log.Printf("%s:\n%s", label, string(out))
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if v == "" {
		return fallback
	}
	return v == "1" || v == "true" || v == "yes"
}

func require(ok bool, name string) {
	if !ok {
		log.Fatalf("missing required env: %s", name)
	}
}
