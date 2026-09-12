package iravoice

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/starling/flock/internal/dialer"
)

type Client struct {
	baseURL    string
	token      string
	tenant     string
	httpClient *http.Client
}

type MakecallResponse struct {
	Status     string `json:"status"`
	StatusCode int    `json:"status_code"`
	CallUUID   string `json:"call_uuid"`
	Slowdown   bool   `json:"slowdown"`
	Cluster    string `json:"cluster"`
	HTTPStatus int
}

func NewClient(baseURL, token, tenant string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		tenant:  tenant,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (c *Client) Makecall(ctx context.Context, req dialer.MakecallRequest) (MakecallResponse, []byte, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return MakecallResponse{}, nil, err
	}

	url := c.baseURL + "/api/makecall"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return MakecallResponse{}, body, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.token)
	httpReq.Header.Set("tenant-id", c.tenant)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return MakecallResponse{}, body, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return MakecallResponse{}, body, err
	}

	var parsed MakecallResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return MakecallResponse{HTTPStatus: resp.StatusCode}, body, fmt.Errorf("decode makecall response: %w", err)
	}
	parsed.HTTPStatus = resp.StatusCode
	return parsed, body, nil
}
