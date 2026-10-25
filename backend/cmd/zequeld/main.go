// Command zequeld is the Zequel local backend daemon. It is started as a
// child process by Electron's main process (see
// apps/desktop/electron/backend.ts) and is never run standalone in normal
// use. It:
//
//  1. Reads its auth token as a single line from stdin (required — the
//     process refuses to start without one; there is no "unauthenticated
//     mode"). Deliberately NOT an environment variable: a process's env vars
//     are readable by other processes owned by the same user (e.g. via
//     /proc/<pid>/environ on Linux, or process-inspection tools on macOS/
//     Windows), which would partly defeat the point of requiring a token in
//     the first place. Stdin, once read, leaves no such standing exposure.
//  2. Binds an HTTP listener to 127.0.0.1 on an OS-assigned ephemeral port
//     (never a fixed port, and never 0.0.0.0).
//  3. Prints that port to stdout as the single line `ZEQUEL_BACKEND_PORT=<n>`,
//     which is how Electron learns where to send requests — there is no port
//     negotiation beyond this.
//  4. Serves until it receives SIGTERM/SIGINT (Electron sends this on quit),
//     then shuts down gracefully with a 5s deadline for in-flight requests.
package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"zequel.dev/backend/internal/server"
)

func readToken() (string, error) {
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	token := strings.TrimSpace(line)
	if token != "" {
		// A token was read even if ReadString also returned io.EOF because
		// the writer closed stdin right after the newline without a trailing
		// byte — that's a normal, successful case, not an error.
		return token, nil
	}
	if err != nil {
		return "", fmt.Errorf("reading token from stdin: %w", err)
	}
	return "", fmt.Errorf("empty token read from stdin")
}

func main() {
	token, err := readToken()
	if err != nil {
		log.Fatalf("failed to read auth token on stdin; refusing to start without auth: %v", err)
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
		Handler:           server.New(token, port),
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
