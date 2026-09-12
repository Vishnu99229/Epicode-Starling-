package window

import (
	"strconv"
	"strings"
	"time"

	"github.com/starling/flock/internal/campaign"
)

func InCallingWindow(window campaign.CallingWindow, now time.Time) bool {
	loc, err := time.LoadLocation(window.Timezone)
	if err != nil {
		loc = time.UTC
	}
	local := now.In(loc)

	weekday := int(local.Weekday())
	allowed := false
	for _, day := range window.DaysOfWeek {
		if day == weekday {
			allowed = true
			break
		}
	}
	if !allowed {
		return false
	}

	start := parseClock(window.StartLocal)
	end := parseClock(window.EndLocal)
	nowClock := local.Hour()*60 + local.Minute()
	return nowClock >= start && nowClock <= end
}

func parseClock(value string) int {
	parts := strings.Split(strings.TrimSpace(value), ":")
	if len(parts) != 2 {
		return 0
	}
	hour, err1 := strconv.Atoi(parts[0])
	min, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return 0
	}
	return int(hour*60 + min)
}
