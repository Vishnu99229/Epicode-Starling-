package cdr

import (
	"encoding/json"
	"strings"
)

type ParsedCDR struct {
	CallUUID        string
	Transcript      json.RawMessage
	LatencyMetrics  json.RawMessage
	UsageMetrics    json.RawMessage
	Raw             json.RawMessage
}

func Parse(body []byte) (ParsedCDR, error) {
	parsed := ParsedCDR{Raw: json.RawMessage(body)}
	var root map[string]json.RawMessage
	if err := json.Unmarshal(body, &root); err != nil {
		return ParsedCDR{}, err
	}

	if v, ok := root["call_transcript"]; ok {
		parsed.Transcript = v
	}
	if v, ok := root["latency_metrics"]; ok {
		parsed.LatencyMetrics = v
	}
	if v, ok := root["usage_metrics"]; ok {
		parsed.UsageMetrics = v
	}

	parsed.CallUUID = extractCallUUID(root)
	return parsed, nil
}

func extractCallUUID(root map[string]json.RawMessage) string {
	if v, ok := root["call_uuid"]; ok {
		if s := strings.TrimSpace(unquoteJSON(v)); s != "" {
			return s
		}
	}
	if v, ok := root["call_info"]; ok {
		var info map[string]json.RawMessage
		if err := json.Unmarshal(v, &info); err == nil {
			if u, ok := info["call_uuid"]; ok {
				return strings.TrimSpace(unquoteJSON(u))
			}
		}
	}
	return ""
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
