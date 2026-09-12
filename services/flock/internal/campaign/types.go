package campaign

import (
	"encoding/json"
	"strings"
)

type Pacing struct {
	MaxConcurrent      int
	TargetCPS          float64
	MaxAttempts        int
	DialTimeoutSec     int
	RetryDelayMinutes  int
	RetryOn            []string
}

type CallingWindow struct {
	Timezone   string
	StartLocal string
	EndLocal   string
	DaysOfWeek []int
}

func ParsePacing(raw json.RawMessage) Pacing {
	p := Pacing{
		MaxConcurrent:     20,
		TargetCPS:         2,
		MaxAttempts:       3,
		DialTimeoutSec:    45,
		RetryDelayMinutes: 30,
		RetryOn:           []string{"no_answer", "busy"},
	}
	if len(raw) == 0 {
		return p
	}
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(raw, &doc); err != nil {
		return p
	}
	if v, ok := doc["maxConcurrent"]; ok {
		p.MaxConcurrent = int(firstNumber(v, float64(p.MaxConcurrent)))
	}
	if v, ok := doc["targetCps"]; ok {
		p.TargetCPS = firstNumber(v, p.TargetCPS)
	}
	if v, ok := doc["maxAttempts"]; ok {
		p.MaxAttempts = int(firstNumber(v, float64(p.MaxAttempts)))
	}
	if v, ok := doc["dialTimeoutSec"]; ok {
		p.DialTimeoutSec = int(firstNumber(v, float64(p.DialTimeoutSec)))
	}
	if v, ok := doc["retryDelayMinutes"]; ok {
		p.RetryDelayMinutes = int(firstNumber(v, float64(p.RetryDelayMinutes)))
	}
	if v, ok := doc["retryOn"]; ok {
		var items []string
		if err := json.Unmarshal(v, &items); err == nil && len(items) > 0 {
			p.RetryOn = items
		}
	}
	return p
}

func ParseCallingWindow(raw json.RawMessage) CallingWindow {
	w := CallingWindow{
		Timezone:   "Asia/Kolkata",
		StartLocal: "09:30",
		EndLocal:   "18:30",
		DaysOfWeek: []int{1, 2, 3, 4, 5, 6},
	}
	if len(raw) == 0 {
		return w
	}
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(raw, &doc); err != nil {
		return w
	}
	if v, ok := doc["timezone"]; ok {
		w.Timezone = firstString(v, w.Timezone)
	}
	if v, ok := doc["startLocal"]; ok {
		w.StartLocal = firstString(v, w.StartLocal)
	}
	if v, ok := doc["endLocal"]; ok {
		w.EndLocal = firstString(v, w.EndLocal)
	}
	if v, ok := doc["daysOfWeek"]; ok {
		var days []int
		if err := json.Unmarshal(v, &days); err == nil && len(days) > 0 {
			w.DaysOfWeek = days
		}
	}
	return w
}

func (p Pacing) RetryAllowed(outcome string) bool {
	outcome = strings.ToLower(strings.TrimSpace(outcome))
	for _, item := range p.RetryOn {
		if strings.ToLower(item) == outcome {
			return true
		}
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
