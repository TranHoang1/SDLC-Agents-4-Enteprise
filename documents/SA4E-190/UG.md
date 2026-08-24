# User Guide - SA4E-190 Autonomy L3 Pipeline Automation

## Overview
This user guide describes the pipeline reset and BRD generation features for SA4E-190 Autonomy L3 Pipeline Automation.

## Installation
Prerequisites:
- Node.js >=18.14.1
- npm >=10.x
- Draw.io CLI at C:\Program Files\draw.io\draw.io.exe

Build backend:
```bash
cd backend
npm install
npm run build
```

## Configuration Reference
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| statusFilePath | string | ../documents/SA4E-190/STATUS.json | Path to STATUS.json |
| brdOutputDir | string | ../documents/SA4E-190 | Output directory for BRD |
| diagramsDir | string | ../documents/SA4E-190/diagrams | Diagram output |
| drawioPath | string | C:\Program Files\draw.io\draw.io.exe | Draw.io CLI path |

## Usage

### Reset Pipeline
Endpoint: POST `/pipeline/reset`

Request body:
```json
{
  "ticket": "SA4E-190",
  "autonomyLevel": "L3",
  "phase": "requirements"
}
```

Response:
```json
{
  "status": "success",
  "ticket": "SA4E-190",
  "phase": "requirements",
  "autonomyLevel": "L3"
}
```

Error codes:
- 400 INVALID_AUTONOMY: Autonomy level must be L1/L2/L3
- 400 INVALID_TICKET: Ticket key required

### Generate BRD
Endpoint: POST `/brd/generate`

Request body:
```json
{
  "ticketKey": "SA4E-190"
}
```

Response:
```json
{
  "path": "documents/SA4E-190/BRD.md",
  "status": "success"
}
```

The BRD is created following template with Purpose, Scope, ≥3 User Stories, Business Rules, NFRs.

## Administration
- Update STATUS.json manually if needed
- Diagrams exported as .drawio and .png to diagrams dir
- Human approval required before phase transition in L3 mode

## Troubleshooting
| Issue | Solution |
|-------|----------|
| STATUS.json not found | Ensure documents/SA4E-190 exists |
| Draw.io export fails | Verify CLI path and install |
| Autonomy validation error | Use L1/L2/L3 only |

## API Reference
See TDD Section 3 for full schemas.

## FAQ
Q: How to trigger pipeline?
A: POST /pipeline/reset with ticket, autonomyLevel L3, phase requirements.

Q: Where is BRD saved?
A: documents/SA4E-190/BRD.md
