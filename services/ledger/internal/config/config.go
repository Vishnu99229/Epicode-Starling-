package config

import (
	"os"
	"strings"
)

type Config struct {
	Port        string
	DatabaseURL string
}

func Load() Config {
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = strings.TrimSpace(os.Getenv("WEBHOOK_PORT"))
	}
	if port == "" {
		port = "8080"
	}

	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		dbURL = "postgres://starling:starling@127.0.0.1:5433/starling?sslmode=disable"
	}

	return Config{
		Port:        port,
		DatabaseURL: dbURL,
	}
}
