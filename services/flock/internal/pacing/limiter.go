package pacing

import (
	"sync"
	"time"
)

type Limiter struct {
	mu              sync.Mutex
	lastDial        time.Time
	minInterval     time.Duration
	campaignActive  map[string]int
}

func New(targetCPS float64) *Limiter {
	l := &Limiter{campaignActive: map[string]int{}}
	l.SetTargetCPS(targetCPS)
	return l
}

func (l *Limiter) SetTargetCPS(targetCPS float64) {
	if targetCPS <= 0 {
		targetCPS = 1
	}
	l.minInterval = time.Duration(float64(time.Second) / targetCPS)
}

func (l *Limiter) Wait() {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.lastDial.IsZero() {
		l.lastDial = time.Now()
		return
	}
	elapsed := time.Since(l.lastDial)
	if elapsed < l.minInterval {
		time.Sleep(l.minInterval - elapsed)
	}
	l.lastDial = time.Now()
}

func (l *Limiter) CanDialCampaign(campaignID string, maxConcurrent int) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if maxConcurrent <= 0 {
		return true
	}
	return l.campaignActive[campaignID] < maxConcurrent
}

func (l *Limiter) TrackStart(campaignID string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.campaignActive[campaignID]++
}

func (l *Limiter) TrackEnd(campaignID string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.campaignActive[campaignID] <= 1 {
		delete(l.campaignActive, campaignID)
		return
	}
	l.campaignActive[campaignID]--
}
