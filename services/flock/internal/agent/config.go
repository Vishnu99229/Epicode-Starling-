package agent

import (
	"encoding/json"
	"strings"
)

type Settings struct {
	BotID                 string
	BotInactivityLimitSec int
	DisableRecording      bool
	Denoise               string
	DialTimeoutSec        int
	VoicemailDetection    bool
}

func Parse(botcomposeBotID string, agentID string, raw json.RawMessage) Settings {
	settings := Settings{
		BotID:            firstNonEmpty(botcomposeBotID, "starling_"+agentID),
		DialTimeoutSec:   300,
		DisableRecording: false,
		Denoise:          "WebRTC NS",
	}
	if len(raw) == 0 {
		return settings
	}

	var doc map[string]json.RawMessage
	if err := json.Unmarshal(raw, &doc); err != nil {
		return settings
	}

	if v, ok := doc["botInactivityEnabled"]; ok && isTrue(v) {
		if limit, ok := doc["botInactivityLimitSec"]; ok {
			settings.BotInactivityLimitSec = int(firstNumber(limit, 0))
		}
	}
	if v, ok := doc["totalCallTimeoutSec"]; ok {
		settings.DialTimeoutSec = int(firstNumber(v, float64(settings.DialTimeoutSec)))
	}
	if v, ok := doc["voicemailDetectionEnabled"]; ok {
		settings.VoicemailDetection = isTrue(v)
	}
	if v, ok := doc["disableRecording"]; ok {
		settings.DisableRecording = isTrue(v)
	}
	if v, ok := doc["denoise"]; ok {
		settings.Denoise = firstString(v, settings.Denoise)
	}
	return settings
}

func isTrue(raw json.RawMessage) bool {
	var b bool
	if err := json.Unmarshal(raw, &b); err == nil {
		return b
	}
	return false
}

func firstString(raw json.RawMessage, fallback string) string {
	var s string
	if err := json.Unmarshal(raw, &s); err == nil && strings.TrimSpace(s) != "" {
		return strings.TrimSpace(s)
	}
	return fallback
}

func firstNumber(raw json.RawMessage, fallback float64) float64 {
	var n float64
	if err := json.Unmarshal(raw, &n); err == nil {
		return n
	}
	return fallback
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
