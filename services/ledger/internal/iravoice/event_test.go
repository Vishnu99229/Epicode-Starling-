package iravoice

import (
	"testing"
)

func TestParseAndExtractLifecycle(t *testing.T) {
	body := []byte(`{
		"event_name": "iravoice::answered",
		"event_data": {
			"timestamp": "2026-09-12T08:50:10Z",
			"call_uuid": "f1000000-0000-4000-8000-000000000001",
			"to_number": "+919876543210",
			"call_params": {
				"campaign_id": "c1000000-0000-4000-8000-000000000001",
				"contact_id": "ct000000-0000-4000-8000-000000000001"
			}
		}
	}`)

	parsed, err := Parse(body)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if parsed.CallUUID != "f1000000-0000-4000-8000-000000000001" {
		t.Fatalf("call_uuid: %s", parsed.CallUUID)
	}

	fields := ExtractFields(parsed.EventName, parsed.EventData)
	if fields.State != "in_progress" {
		t.Fatalf("state: %s", fields.State)
	}
	if fields.ToNumber != "+919876543210" {
		t.Fatalf("to_number: %s", fields.ToNumber)
	}
	if fields.CampaignID == "" || fields.ContactID == "" {
		t.Fatalf("missing correlation ids")
	}
}

func TestShouldAdvanceState(t *testing.T) {
	if !ShouldAdvanceState("dialing", "ringing") {
		t.Fatal("expected dialing -> ringing")
	}
	if ShouldAdvanceState("in_progress", "ringing") {
		t.Fatal("should not regress to ringing")
	}
	if !ShouldAdvanceState("in_progress", "completed") {
		t.Fatal("expected in_progress -> completed")
	}
}
