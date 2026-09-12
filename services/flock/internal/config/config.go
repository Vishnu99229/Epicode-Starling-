package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DatabaseURL        string
	IraVoiceBaseURL    string
	IraVoiceToken      string
	EpicodeTenant      string
	EventURLBase       string
	BotWebSocketHost   string
	BotWebSocketPort   string
	BotWebSocketApp    string
	CPAConfig          string
	StreamFrameSizeMs  int
	STTSamplingRate    int
	TTSSamplingRate    int
	DryRun             bool
	Once               bool
	BatchSize          int
	PollIntervalSec    int
}

func Load() Config {
	return Config{
		DatabaseURL: env(
			"DATABASE_URL",
			"postgres://starling:starling@127.0.0.1:5433/starling?sslmode=disable",
		),
		IraVoiceBaseURL: strings.TrimRight(firstNonEmpty(
			os.Getenv("IRAVOICE_BASE_URL"),
			trimMakecallURL(os.Getenv("IRAVOICE_MAKECALL_URL")),
		), "/"),
		IraVoiceToken:     strings.TrimSpace(os.Getenv("IRAVOICE_BEARER_TOKEN")),
		EpicodeTenant:     env("EPICODE_TENANT", "copter"),
		EventURLBase: strings.TrimRight(firstNonEmpty(
			os.Getenv("EVENT_URL_BASE"),
			os.Getenv("EVENT_URL"),
			"http://100.91.56.26:8080",
		), "/"),
		BotWebSocketHost:  env("BOT_WEBSOCKET_HOST", "localhost"),
		BotWebSocketPort:  env("BOT_WEBSOCKET_PORT", "443"),
		BotWebSocketApp:   env("BOT_WEBSOCKET_APP", "bot"),
		CPAConfig:         strings.TrimSpace(os.Getenv("IRAVOICE_CPA_CONFIG")),
		StreamFrameSizeMs: envInt("STREAM_FRAME_SIZE_MS", 20),
		STTSamplingRate:   envInt("STT_SAMPLING_RATE", 16000),
		TTSSamplingRate:   envInt("TTS_SAMPLING_RATE", 24000),
		DryRun:            envBool("FLOCK_DRY_RUN", false),
		Once:              envBool("FLOCK_ONCE", false),
		BatchSize:         envInt("FLOCK_BATCH_SIZE", 10),
		PollIntervalSec:   envInt("FLOCK_POLL_INTERVAL_SEC", 2),
	}
}

func trimMakecallURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	return strings.TrimSuffix(strings.TrimSuffix(raw, "/api/makecall"), "/makecall")
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" && v != "FILL_IN" {
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

func envInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" && strings.TrimSpace(v) != "FILL_IN" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
