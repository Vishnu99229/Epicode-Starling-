package iravoice

import (
	"encoding/json"
	"strings"
	"time"
)

// ParsedEvent is a best-effort view of an IraVoice webhook envelope.
// Unknown fields remain in Raw and inside EventData.
type ParsedEvent struct {
	EventName string
	CallUUID  string
	Raw       json.RawMessage
	EventData map[string]json.RawMessage
}

type EventFields struct {
	CallUUID     string
	CampaignID   string
	ContactID    string
	DialJobID    string
	Cluster      string
	CPAEvent     string
	FromNumber   string
	ToNumber     string
	HangupCause  string
	DurationSec  *float64
	EventTime    *time.Time
	State        string
	AdvanceState bool
}

var stateRank = map[string]int{
	"queued":       0,
	"dialing":      1,
	"ringing":      2,
	"in_progress":  3,
	"completed":    4,
	"failed":       4,
	"retry_wait":   4,
	"skipped":      4,
	"dead":         4,
	"analyzed":     5,
}

func Parse(body []byte) (ParsedEvent, error) {
	var root map[string]json.RawMessage
	if err := json.Unmarshal(body, &root); err != nil {
		return ParsedEvent{}, err
	}

	parsed := ParsedEvent{Raw: json.RawMessage(body)}
	if v, ok := root["event_name"]; ok {
		parsed.EventName = strings.TrimSpace(unquoteJSON(v))
	}
	if v, ok := root["event_data"]; ok {
		var eventData map[string]json.RawMessage
		if err := json.Unmarshal(v, &eventData); err == nil {
			parsed.EventData = eventData
			if u, ok := eventData["call_uuid"]; ok {
				parsed.CallUUID = strings.TrimSpace(unquoteJSON(u))
			}
		}
	}
	if parsed.CallUUID == "" {
		if v, ok := root["call_uuid"]; ok {
			parsed.CallUUID = strings.TrimSpace(unquoteJSON(v))
		}
	}
	return parsed, nil
}

func ExtractFields(eventName string, eventData map[string]json.RawMessage) EventFields {
	fields := EventFields{}

	if v, ok := eventData["call_uuid"]; ok {
		fields.CallUUID = strings.TrimSpace(unquoteJSON(v))
	}
	if v, ok := eventData["timestamp"]; ok {
		fields.EventTime = parseTime(unquoteJSON(v))
	}
	if v, ok := eventData["from_number"]; ok {
		fields.FromNumber = strings.TrimSpace(unquoteJSON(v))
	}
	if v, ok := eventData["to_number"]; ok {
		fields.ToNumber = strings.TrimSpace(unquoteJSON(v))
	}
	if v, ok := eventData["cluster"]; ok {
		fields.Cluster = strings.TrimSpace(unquoteJSON(v))
	}

	fields.CPAEvent = firstString(eventData,
		"cpa_event", "cpa_result", "cpa", "cpa_status",
	)
	fields.HangupCause = firstString(eventData,
		"hangup_cause", "hangup_reason", "sip_hangup_cause", "reason", "cause",
	)
	fields.DurationSec = firstFloat(eventData, "duration_sec", "duration", "billsec")

	if params, ok := eventData["call_params"]; ok {
		var callParams map[string]json.RawMessage
		if err := json.Unmarshal(params, &callParams); err == nil {
			fields.CampaignID = firstString(callParams, "campaign_id")
			fields.ContactID = firstString(callParams, "contact_id")
			fields.DialJobID = firstString(callParams, "dial_job_id")
			if fields.Cluster == "" {
				fields.Cluster = firstString(callParams, "cluster")
			}
		}
	}

	switch eventName {
	case "iravoice::started":
		fields.State = "dialing"
		fields.AdvanceState = true
	case "iravoice::ringing":
		fields.State = "ringing"
		fields.AdvanceState = true
	case "iravoice::answered":
		fields.State = "in_progress"
		fields.AdvanceState = true
	case "iravoice::hangup":
		fields.State = "completed"
		fields.AdvanceState = true
	}

	return fields
}

func ShouldAdvanceState(current, next string) bool {
	if next == "" {
		return false
	}
	if current == "" || current == next {
		return next != ""
	}
	return stateRank[next] >= stateRank[current]
}

func unquoteJSON(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	return strings.Trim(string(raw), `"`)
}

func firstString(data map[string]json.RawMessage, keys ...string) string {
	for _, key := range keys {
		if v, ok := data[key]; ok {
			s := strings.TrimSpace(unquoteJSON(v))
			if s != "" {
				return s
			}
		}
	}
	return ""
}

func firstFloat(data map[string]json.RawMessage, keys ...string) *float64 {
	for _, key := range keys {
		if v, ok := data[key]; ok {
			var f float64
			if err := json.Unmarshal(v, &f); err == nil {
				return &f
			}
		}
	}
	return nil
}

func parseTime(value string) *time.Time {
	if value == "" {
		return nil
	}
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T%H:%M:%SZ",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, value); err == nil {
			return &t
		}
	}
	return nil
}
