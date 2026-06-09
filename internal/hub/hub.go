package hub

import (
	"encoding/json"
	"fmt"
	"net/http"
)

type Event struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

type Hub struct {
	clients    map[chan Event]struct{}
	register   chan chan Event
	unregister chan chan Event
	broadcast  chan Event
}

func New() *Hub {
	return &Hub{
		clients:    make(map[chan Event]struct{}),
		register:   make(chan chan Event),
		unregister: make(chan chan Event),
		broadcast:  make(chan Event, 64),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case ch := <-h.register:
			h.clients[ch] = struct{}{}
		case ch := <-h.unregister:
			if _, ok := h.clients[ch]; ok {
				delete(h.clients, ch)
				close(ch)
			}
		case event := <-h.broadcast:
			for ch := range h.clients {
				select {
				case ch <- event:
				default:
					// slow client — drop
				}
			}
		}
	}
}

func (h *Hub) Broadcast(event Event) {
	h.broadcast <- event
}

func (h *Hub) ServeSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := make(chan Event, 16)
	h.register <- ch
	defer func() { h.unregister <- ch }()

	fmt.Fprintf(w, "event: connected\ndata: {}\n\n")
	flusher.Flush()

	for {
		select {
		case event, ok := <-ch:
			if !ok {
				return
			}
			data, _ := json.Marshal(event.Data)
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, data)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}
