package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Client struct {
	Name   string `yaml:"name"`
	Secret string `yaml:"secret"`
}

type Config struct {
	Port          string   `yaml:"port"`
	Password      string   `yaml:"password"`
	SessionSecret string   `yaml:"session_secret"`
	DBFile        string   `yaml:"db_file"`
	Clients       []Client `yaml:"clients"`
}

func Load() (*Config, error) {
	path := os.Getenv("CONFIG_FILE")
	if path == "" {
		path = "config.yaml"
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file %q: %w", path, err)
	}

	cfg := &Config{
		Port:   "8080",
		DBFile: "notifeed.db",
	}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config file: %w", err)
	}

	if cfg.Password == "" {
		return nil, fmt.Errorf("password is required")
	}
	if cfg.SessionSecret == "" {
		return nil, fmt.Errorf("session_secret is required")
	}

	return cfg, nil
}

func (c *Config) FindClient(name string) (Client, bool) {
	for _, client := range c.Clients {
		if client.Name == name {
			return client, true
		}
	}
	return Client{}, false
}
