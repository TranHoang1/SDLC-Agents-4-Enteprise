# User Guide — SA4E-92: NDJSON Streaming Ingestion

## Overview

This feature replaces the bulk JSON batch ingestion of Pega rules with NDJSON (Newline Delimited JSON) streaming. The backend no longer loads entire rule batches into memory, eliminating OOM crashes when indexing large Pega applications (67,000+ rules).

## What Changed

| Before (Bulk) | After (NDJSON Stream) |
|---|---|
| 7 concurrent HTTP requests × 1000 rules × ~10KB/rule | Single HTTP request, rules streamed line-by-line |
| Backend loads full JSON array into memory (~4GB) | Backend processes one rule at a time (constant memory) |
| OOM crash on large projects | Stable regardless of project size |

## How It Works

### Extension Side

The `PegaStreamIngester` sends all rules in a single HTTP POST with:
- **Content-Type**: `application/x-ndjson`
- **Transfer**: Chunked (streaming body via `ReadableStream`)
- **Format**: First line = metadata JSON, subsequent lines = one rule JSON per line

### Backend Side

The `/api/v1/pega/ingest-stream` endpoint:
1. Reads the request body as a stream (never buffers the full body)
2. Splits incoming bytes into lines at `\n` boundaries
3. Processes each rule individually (parse → validate → insert DB)
4. Returns aggregate statistics after all lines processed

## Configuration

No new configuration is required. The streaming endpoint uses the same `backendUrl` setting:

```
kiroSdlc.backendUrl = "http://localhost:48721"
```

## Compatibility

- The old `/api/v1/pega/crawl-batch` endpoint is still available for other consumers (e.g., MCP tools)
- Requires Node.js 18+ (for `ReadableStream` + `duplex: 'half'` fetch support)
- The `PegaMcpTools.ts` crawl commands continue to use the original bulk endpoint

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Ingest stream failed: HTTP 503` | Backend memory module not ready | Wait for backend startup to complete |
| `Ingest stream failed: HTTP 400 — Request body is empty` | Network interrupted the stream | Retry the indexing operation |
| `Stream ingest failed: fetch failed` | Backend not running | Ensure backend is started (`npm run dev` in backend/) |
| Rules not appearing in KB after stream | Individual rule parse errors | Check backend logs for `[pega-stream] Single rule ingest failed` |

## API Reference

### POST `/api/v1/pega/ingest-stream`

**Content-Type**: `application/x-ndjson`

**Request body** (NDJSON format):
```
{"__meta":true,"projectId":"abc123","checksums":{},"versions":{},"visitedKeys":[]}\n
{"pxObjClass":"Rule-Obj-Activity","pyClassName":"Work-Claim","pyRuleName":"ValidateAddress",...}\n
{"pxObjClass":"Rule-Obj-Property","pyClassName":"Work-Claim","pyRuleName":"FirstName",...}\n
```

**Response** (JSON):
```json
{
  "data": {
    "stored": 42,
    "totalRulesInDb": 1350,
    "totalKbEntriesInDb": 2700,
    "totalGraphNodesInDb": 1350,
    "nextBatch": [
      { "insKey": "RULE-OBJ-CLASS Work-Claim-Sub", "pxObjClass": "Rule-Obj-Class", "pyClassName": "Work-Claim-Sub", "pyRuleName": "" }
    ]
  },
  "error": null
}
```

**Error responses**:
- `503` — Memory module not initialized
- `400` — Empty request body
- `500` — Stream processing error (details in `error.message`)

## Performance Characteristics

| Metric | Value |
|---|---|
| Backend memory per rule | ~10KB (single rule in-flight, released after DB insert) |
| Maximum batch size | Unlimited (stream has no size constraint) |
| HTTP connections | 1 (vs. 7 concurrent before) |
| Latency overhead | ~2ms per rule (sequential DB inserts) |
| Network efficiency | Chunked transfer encoding, no buffering |
