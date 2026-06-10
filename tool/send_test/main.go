package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
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

	p := payload{
		ID:        randomID(),
		Title:     "Test notification",
		Message:   "Hello from send_test tool",
		Level:     "info",
		Channel:   "webhook:notifeed",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Source:    client.Name,
	}

	body, _ := json.Marshal(p)

	mac := hmac.New(sha256.New, []byte(client.Secret))
	mac.Write(body)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	url := fmt.Sprintf("http://localhost:%s/webhook/%s", cfg.Port, client.Name)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-PNS-Signature", sig)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println("error:", err)
		return
	}
	defer resp.Body.Close()
	fmt.Println("response:", resp.Status)
}

func randomID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
