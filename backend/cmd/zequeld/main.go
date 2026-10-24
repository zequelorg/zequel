// Command zequeld is the Zequel local backend daemon. It is started as a
// child process by Electron's main process (see
// apps/desktop/electron/backend.ts) and is never run standalone in normal
// use. It:
//
//  1. Reads its auth token from ZEQUEL_BACKEND_TOKEN (required — the process
//     refuses to start without one; there is no "unauthenticated mode").
//  2. Binds an HTTP listener to 127.0.0.1 on an OS-assigned ephemeral port
//     (never a fixed port, and never 0.0.0.0).
//  3. Prints that port to stdout as the single line `ZEQUEL_BACKEND_PORT=<n>`,
//     which is how Electron learns where to send requests — there is no port
//     negotiation beyond this.
//  4. Serves until it receives SIGTERM/SIGINT (Electron sends this on quit),
//     then shuts down gracefully with a 5s deadline for in-flight requests.
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"zequel.dev/backend/internal/server"
)

func main() {
	token := os.Getenv("ZEQUEL_BACKEND_TOKEN")
	if token == "" {
		log.Fatal("ZEQUEL_BACKEND_TOKEN is required; refusing to start without auth")
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatalf("failed to bind loopback listener: %v", err)
	}

	port := listener.Addr().(*net.TCPAddr).Port
	// This exact line format is load-bearing: apps/desktop/electron/backend.ts
	// parses stdout for it. Changing the format requires updating both sides.
	fmt.Printf("ZEQUEL_BACKEND_PORT=%d\n", port)

	httpServer := &http.Server{
		Handler:           server.New(token),
		ReadHeaderTimeout: 10 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		serveErr <- httpServer.Serve(listener)
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)

	select {
	case err := <-serveErr:
		if err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	case <-sigCh:
		log.Println("shutdown signal received, draining in-flight requests")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(ctx); err != nil {
			log.Printf("graceful shutdown error: %v", err)
		}
	}
}
