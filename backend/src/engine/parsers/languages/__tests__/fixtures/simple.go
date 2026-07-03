package main

import (
	"fmt"
	"os"

	log "github.com/sirupsen/logrus"
)

// MaxRetries is the maximum number of retries
const MaxRetries = 3

var Version = "1.0.0"

// Server represents an HTTP server
type Server struct {
	Host    string
	Port    int
	running bool
}

// Handler defines the request handler interface
type Handler interface {
	ServeHTTP(w ResponseWriter, r *Request)
	Health() error
}

// NewServer creates a new server instance
func NewServer(host string, port int) *Server {
	return &Server{Host: host, Port: port}
}

// Start starts the server
func (s *Server) Start() error {
	s.running = true
	go s.listen()
	defer s.cleanup()
	fmt.Printf("Server started on %s:%d\n", s.Host, s.Port)
	return nil
}

func (s *Server) listen() {
	fmt.Println("Listening...")
}

func (s *Server) cleanup() {
	s.running = false
}

func processRequest(data []byte) (int, error) {
	if len(data) == 0 {
		return 0, fmt.Errorf("empty data")
	}
	return len(data), nil
}
