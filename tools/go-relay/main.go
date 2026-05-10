package main

import (
	"bytes"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	base := os.Getenv("API_BASE_URL")
	secret := os.Getenv("INTERNAL_TICK_SECRET")
	if base == "" || secret == "" {
		log.Fatal("API_BASE_URL and INTERNAL_TICK_SECRET are required")
	}

	interval := 5 * time.Minute
	if v := os.Getenv("TICK_INTERVAL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			log.Fatalf("bad TICK_INTERVAL: %v", err)
		}
		interval = d
	}

	tick := func() {
		req, err := http.NewRequest(http.MethodPost, base+"/internal/tick", nil)
		if err != nil {
			log.Printf("tick: build request: %v", err)
			return
		}
		req.Header.Set("X-Internal-Auth", secret)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("tick: request: %v", err)
			return
		}
		defer res.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		if res.StatusCode < 200 || res.StatusCode >= 300 {
			log.Printf("tick: HTTP %d %s", res.StatusCode, bytes.TrimSpace(body))
			return
		}
		log.Printf("tick: ok %s", bytes.TrimSpace(body))
	}

	tick()
	t := time.NewTicker(interval)
	defer t.Stop()
	for range t.C {
		tick()
	}
}
