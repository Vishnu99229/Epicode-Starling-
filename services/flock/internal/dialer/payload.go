package dialer

import (
	"fmt"
	"strings"

	"github.com/starling/flock/internal/agent"
	"github.com/starling/flock/internal/config"
	"github.com/starling/flock/internal/store"
)

type MakecallRequest struct {
	CampaignName string                 `json:"campaign_name"`
	ToNumber     string                 `json:"to_number"`
	FromNumber   string                 `json:"from_number,omitempty"`
	CallParams   map[string]interface{} `json:"call_params"`
	ChannelVars  map[string]string      `json:"channel_vars,omitempty"`
	CPAConfig    string                 `json:"cpa_config,omitempty"`
	DialTimeout  int                    `json:"dial_timeout"`
}

func BuildMakecall(job store.ClaimedJob, cfg config.Config, agentSettings agent.Settings) (MakecallRequest, error) {
	if strings.TrimSpace(job.IraVoiceCampaignName) == "" {
		return MakecallRequest{}, fmt.Errorf("campaign %s missing iravoice_campaign_name", job.CampaignID)
	}
	if strings.TrimSpace(cfg.EventURL) == "" {
		return MakecallRequest{}, fmt.Errorf("EVENT_URL is required")
	}

	wssURL := fmt.Sprintf(
		"wss://%s:%s/%s",
		strings.TrimSpace(cfg.BotWebSocketHost),
		strings.TrimSpace(cfg.BotWebSocketPort),
		strings.TrimPrefix(strings.TrimSpace(cfg.BotWebSocketApp), "/"),
	)
	if !strings.HasPrefix(wssURL, "wss://") {
		return MakecallRequest{}, fmt.Errorf("bot websocket must use wss://")
	}

	macros := map[string]string{}
	channelVars := map[string]string{}
	if strings.TrimSpace(job.ContactName) != "" {
		macros["contact_name"] = job.ContactName
	}
	for key, value := range job.ContactAttributes {
		macros[key] = value
		channelVars["sip_h_X-"+sanitizeHeaderKey(key)] = value
	}

	callParams := map[string]interface{}{
		"bot_id":                 agentSettings.BotID,
		"event_url":              strings.TrimRight(cfg.EventURL, "/") + "/webhooks/iravoice",
		"campaign_id":            job.CampaignID,
		"contact_id":             job.ContactID,
		"dial_job_id":            job.ID,
		"websocket_host":         cfg.BotWebSocketHost,
		"websocket_port":         cfg.BotWebSocketPort,
		"websocket_app":          strings.TrimPrefix(cfg.BotWebSocketApp, "/"),
		"websocket_url":          wssURL,
		"stream_on_cpa_events":   []string{"LV"},
		"drop_on_cpa_events":     []string{"AM", "FX"},
		"stream_frame_size_ms":   cfg.StreamFrameSizeMs,
		"stt_sampling_rate":      cfg.STTSamplingRate,
		"tts_sampling_rate":      cfg.TTSSamplingRate,
		"disable_recording":      agentSettings.DisableRecording,
		"denoise":                agentSettings.Denoise,
		"macros":                 macros,
	}
	if agentSettings.BotInactivityLimitSec > 0 {
		callParams["bot_inactivity_limit"] = agentSettings.BotInactivityLimitSec
	}

	dialTimeout := agentSettings.DialTimeoutSec
	if dialTimeout <= 0 && job.Pacing.DialTimeoutSec > 0 {
		dialTimeout = job.Pacing.DialTimeoutSec
	}

	req := MakecallRequest{
		CampaignName: job.IraVoiceCampaignName,
		ToNumber:     job.PhoneNumber,
		CallParams:   callParams,
		ChannelVars:  channelVars,
		DialTimeout:  dialTimeout,
	}
	if cfg.CPAConfig != "" && agentSettings.VoicemailDetection {
		req.CPAConfig = cfg.CPAConfig
	}
	return req, nil
}

func sanitizeHeaderKey(key string) string {
	key = strings.TrimSpace(key)
	key = strings.ReplaceAll(key, " ", "_")
	return key
}
