package dialer

import (
	"encoding/json"
	"testing"

	"github.com/starling/flock/internal/agent"
	"github.com/starling/flock/internal/campaign"
	"github.com/starling/flock/internal/config"
	"github.com/starling/flock/internal/store"
)

func TestBuildMakecallSample(t *testing.T) {
	cfg := config.Config{
		EventURL:          "https://ledger.example",
		BotWebSocketHost:  "bot.example.com",
		BotWebSocketPort:  "443",
		BotWebSocketApp:   "voice",
		StreamFrameSizeMs: 20,
		STTSamplingRate:   16000,
		TTSSamplingRate:   24000,
		CPAConfig:         "default_cpa",
	}

	job := store.ClaimedJob{
		ID:                   "f2000000-0000-4000-8000-000000000001",
		CampaignID:           "d4000000-0000-4000-8000-000000000001",
		ContactID:            "ct000000-0000-4000-8000-000000000001",
		AttemptNo:            1,
		PhoneNumber:          "+919876543210",
		ContactName:          "Ravi Kumar",
		ContactAttributes:    map[string]string{"emi_amount": "4200", "due_date": "2026-09-15"},
		IraVoiceCampaignName: "vishnu_emi_out",
		Pacing: campaign.Pacing{
			DialTimeoutSec: 45,
		},
		AgentID:         "a1000000-0000-4000-8000-000000000001",
		BotcomposeBotID: "starling_a1000000-0000-4000-8000-000000000001",
		AgentConfig: json.RawMessage(`{
			"botInactivityEnabled": true,
			"botInactivityLimitSec": 12,
			"totalCallTimeoutSec": 180,
			"voicemailDetectionEnabled": true,
			"disableRecording": false,
			"denoise": "Hush"
		}`),
	}

	agentSettings := agent.Parse(job.BotcomposeBotID, job.AgentID, job.AgentConfig)
	req, err := BuildMakecall(job, cfg, agentSettings)
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	if req.CampaignName != "vishnu_emi_out" {
		t.Fatalf("campaign_name: %s", req.CampaignName)
	}
	if req.CallParams["bot_inactivity_limit"] != 12 {
		t.Fatalf("bot_inactivity_limit missing")
	}

	out, err := json.MarshalIndent(req, "", "  ")
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	t.Logf("sample makecall payload:\n%s", string(out))
}
