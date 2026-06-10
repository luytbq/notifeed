package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"strings"
	"time"

	"notifeed/internal/config"
)

type payload struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	Level     string `json:"level"`
	Channel   string `json:"channel"`
	CreatedAt string `json:"created_at"`
	Source    string `json:"source"`
}

func main() {
	title := flag.String("title", "", "notification title")
	message := flag.String("msg", "", "notification message")
	level := flag.String("level", "info", "level: info|warning|error|critical")
	source := flag.String("source", "", "override source (default: first client name)")
	count := flag.Int("n", 1, "number of notifications to send")
	bulk := flag.Bool("bulk", false, "send a preset batch of varied notifications for search testing")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		fmt.Println("load config:", err)
		return
	}
	if len(cfg.Clients) == 0 {
		fmt.Println("no clients configured")
		return
	}

	client := cfg.Clients[0]
	src := client.Name
	if *source != "" {
		src = *source
	}

	var notifications []payload

	if *bulk {
		notifications = bulkPayloads(src)
	} else {
		t := *title
		m := *message
		if t == "" {
			t = defaultTitle(*level)
		}
		if m == "" {
			m = fmt.Sprintf("[%s] Hello from send_test tool", strings.ToUpper(*level))
		}
		for i := 0; i < *count; i++ {
			notifications = append(notifications, payload{
				ID:        randomID(),
				Title:     t,
				Message:   m,
				Level:     *level,
				Channel:   "webhook:notifeed",
				CreatedAt: time.Now().UTC().Format(time.RFC3339),
				Source:    src,
			})
		}
	}

	for _, p := range notifications {
		send(cfg.Port, client.Name, client.Secret, p)
	}
}

func send(port, clientName, secret string, p payload) {
	body, _ := json.Marshal(p)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	url := fmt.Sprintf("http://localhost:%s/webhook/%s", port, clientName)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-PNS-Signature", sig)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("error sending [%s] %s: %v\n", p.Level, p.Title, err)
		return
	}
	defer resp.Body.Close()
	fmt.Printf("%s  [%-8s]  %s\n", resp.Status, p.Level, p.Title)
}

func defaultTitle(level string) string {
	switch level {
	case "warning":
		return "Warning alert"
	case "error":
		return "Error alert"
	case "critical":
		return "Critical alert"
	default:
		return "Info notification"
	}
}

// bulkPayloads returns a varied set of notifications for testing search/filter UX.
func bulkPayloads(source string) []payload {
	now := time.Now().UTC()
	entries := []struct {
		title, message, level string
		ago                   time.Duration
	}{
		{"Deployment succeeded", "Service api-gateway deployed to production (v2.4.1)", "info", 0},
		{"High memory usage", "Worker pod memory at 87% — approaching OOM threshold", "warning", time.Minute},
		{"Payment gateway timeout", "Stripe API returned 504 after 30s — retrying", "error", 2 * time.Minute},
		{"Database connection lost", "Primary DB unreachable — failover to replica initiated", "critical", 3 * time.Minute},
		{"New user signup", "user@example.com registered via OAuth", "info", 5 * time.Minute},
		{"Slow query detected", "Query on orders table took 4.2s — index missing", "warning", 8 * time.Minute},
		{"Backup completed", "Daily snapshot stored to S3 (2.1 GB)", "info", 10 * time.Minute},
		{"SSL certificate expiring", "cert for api.example.com expires in 7 days", "warning", 15 * time.Minute},
		{"Disk space critical", "/var/log at 95% — log rotation failed", "critical", 20 * time.Minute},
		{"Webhook delivery failed", "3 consecutive failures to https://client.example.com/hooks", "error", 25 * time.Minute},
		{"Cache invalidated", "Redis keyspace flushed after config update", "info", 30 * time.Minute},
		{"Login from new device", "Admin account logged in from IP 203.0.113.42 (Singapore)", "warning", 45 * time.Minute},
	}

	var out []payload
	for _, e := range entries {
		out = append(out, payload{
			ID:        randomID(),
			Title:     e.title,
			Message:   e.message,
			Level:     e.level,
			Channel:   "webhook:notifeed",
			CreatedAt: now.Add(-e.ago).Format(time.RFC3339),
			Source:    source,
		})
	}
	return out
}

func randomID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
