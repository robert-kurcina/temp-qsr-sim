# MEST Tactics Simulator

A tabletop wargame simulator for the MEST Tactics game rules with AI-driven battles and comprehensive visual audit tooling.

## Overview

**Project Status:** ✅ Complete — All core features implemented

**What This Is:**
- AI vs AI battle simulator
- Visual audit dashboard for battle analysis
- Interactive battlefield generator with terrain density controls
- Pathfinding, LOS/LOF, and combat visualization
- Agility movement optimization analysis
- Character portrait system with species-based assignment

---

## Quick Start

### Run a Battle

```bash
# Generate AI battle with default settings
npm run ai-battle

# Generate with specific settings
npm run ai-battle -- VERY_SMALL 50

# Generate with audit and viewer
npm run ai-battle -- --audit --viewer
```

### Open Dashboard

```bash
# Start dashboard server
npm run serve:reports

# Open in browser
http://localhost:3001/dashboard
```

---

## Battle Audit Dashboard 🎬

**5-tab interface for battle analysis and battlefield generation**

### Tab 1: 🗺️ Battlefield Generator

**Interactive battlefield generation with terrain density controls:**

| Control | Description | Options |
|---------|-------------|---------|
| **Battlefield Size** | Select battlefield dimensions | VERY_SMALL (24×24), SMALL (36×36), MEDIUM (48×48), LARGE (60×60), VERY_LARGE (72×72) |
| **Area Terrain** | Rough patches density | 0-100% (presets: 0, 20, 50, 80, 100) |
| **Buildings** | Building density | 0-100% (presets: 0, 20, 50, 80, 100) |
| **Walls** | Wall density | 0-100% (presets: 0, 20, 50, 80, 100) |
| **Trees** | Tree density | 0-100% (presets: 0, 20, 50, 80, 100) |
| **Rocks** | Rock density | 0-100% (presets: 0, 20, 50, 80, 100) |
| **Shrubs** | Shrub density | 0-100% (presets: 0, 20, 50, 80, 100) |

**Generation Results:**
- Terrain count
- Coverage ratio (%)
- Fitness score (0-100)
- Generation time (ms)

### Tab 2: 🧭 Pathfinding Check

**Interactive pathfinding analysis with Agility optimization:**

| Feature | Description |
|---------|-------------|
| **Start/End Markers** | Click to place 🟢 start and 🔴 end markers on battlefield |
| **Footprint** | Character base diameter (0.5-3.0 MU) |
| **Movement Allowance** | Available movement (1-12 MU) |
| **Navigate** | Calculate A* path with terrain costs |
| **Analyze Agility** | Show Agility optimization opportunities |

**Agility Analysis Results:**
- Base MU Cost (without Agility)
- Agility MU Cost (with optimization)
- MU Saved (difference)
- Optimal Path indicator (✅/❌)

**Agility Opportunities Detected:**
| Type | Description | QSR Rule |
|------|-------------|----------|
| **Bypass** | Treat Rough/Difficult as Clear | Agility ≥ baseDiameter/2 |
| **Climb Up** | Climb vertical surface | Height ≤ baseHeight |
| **Climb Down** | Descend vertical surface | Height ≤ baseHeight |
| **Jump Up** | Leap upward | Height ≤ Agility/2 |
| **Jump Down** | Leap downward | Height ≤ Agility |
| **Jump Across** | Cross gap | Width ≤ Agility |
| **Running Jump** | Jump with run-up bonus | Distance ≤ Agility + (moveDist/4) |

**Interactive Features:**
- Click SVG marker → highlight list item, scroll to it
- Click list item → pulse animation on SVG marker
- Color-coded: 🟢 optimal, 🟡 sub-optimal, 🔴 missed

### Tab 3: 👁️ LOS & Cover Check

**Interactive LOS/LOF and cover determination:**

| Feature | Description |
|---------|-------------|
| **Active/Target Markers** | Place 🔵 active and 🟠 target markers |
| **Target Type** | Model or Location (for indirect attacks) |
| **Leaning** | Active model is leaning (uses Agility) |
| **Show LOF Arc** | Display 60° field of fire cone |
| **Target SIZ** | Target size (1-9) |

**Results Display:**
- Line of Sight: Clear/Blocked status
- Blocked By: Terrain feature or model ID
- Direct Cover: Yes/No (Soft/Hard)
- Intervening Cover: Yes/No (Soft/Hard)
- Cover Result: None/Soft/Hard/Blocking
- LOF Arc: 60° cone with targets in arc

### Tab 4: 🎬 Visual Audit

**Interactive battle replay with overlays:**

| Overlay | Description | Toggle |
|---------|-------------|--------|
| **Paths** | Green=success, Red=failed movement | ✅ Show Paths |
| **LOS** | Blue=clear, Red=blocked visibility | ✅ Show LOS |
| **LOF** | Purple=line of fire arcs | ✅ Show LOF |
| **Delaunay Mesh** | Pathfinding navigation mesh | ✅ Show Delaunay |
| **Grid** | 0.5 MU measurement grid | ✅ Show Grid |
| **Deployment** | Starting zones | ✅ Show Deployment |

**Controls:**
- ⏹ Stop → Reset to Turn 1
- ⏯ Play/Pause → Auto-advance turns
- ⏮ Prev / ⏭ Next → Step through turns
- Turn Slider → Scrub to any turn
- Speed Control → 0.25x, 0.5x, 1x, 2x, 4x playback

**Features:**
- Model roster with clickable portraits
- Click action in log → jump to that turn
- Click model → show stats panel
- Failed actions highlighted in red

### Tab 5: 📊 Summary

Human-readable battle summaries:
- Executive summary (1-2 paragraphs)
- Key statistics table
- MVP (Most Valuable Model) identification
- Turning point analysis
- Key moments highlights

### Tab 6: 🖼️ Portraits

Reference gallery for character portraits:
- All 11 portrait sheets
- Species and SIZ information
- 8×6 grid layout (48 portraits per sheet)

---

## API Endpoints

```bash
# List all battles
curl http://localhost:3001/api/battles

# Filter battles
curl "http://localhost:3001/api/battles?gameSize=VERY_SMALL"
curl "http://localhost:3001/api/battles?mission=QAI_11"

# Get battlefield SVG
curl http://localhost:3001/api/battles/battle-report-*/svg

# Get full audit JSON
curl http://localhost:3001/api/battles/battle-report-*/audit

# Get human-readable summary
curl http://localhost:3001/api/battles/battle-report-*/summary

# Generate battlefield
curl -X POST http://localhost:3001/api/battlefields/generate \
  -H "Content-Type: application/json" \
  -d '{"gameSize":"MEDIUM","terrainDensities":{"area":50,"building":30,"wall":30,"tree":50,"rocks":40,"shrub":40}}'

# Analyze pathfinding
curl -X POST http://localhost:3001/api/battlefields/pathfind \
  -H "Content-Type: application/json" \
  -d '{"battlefieldId":"generated-*","start":{"x":2,"y":2},"end":{"x":10,"y":10},"footprintDiameter":1,"movementAllowance":6}'

# Analyze Agility optimization
curl -X POST http://localhost:3001/api/battlefields/analyze-agility \
  -H "Content-Type: application/json" \
  -d '{"battlefieldId":"generated-*","path":[{"x":2,"y":2},{"x":5,"y":5},{"x":10,"y":5}],"character":{"mov":4,"siz":3,"baseDiameter":1}}'

# Check LOS and Cover
curl -X POST http://localhost:3001/api/battlefields/los-check \
  -H "Content-Type: application/json" \
  -d '{"battlefieldId":"generated-*","activeModel":{"position":{"x":2,"y":6},"baseDiameter":1,"siz":3},"target":{"position":{"x":10,"y":6},"siz":3},"showLofArc":true}'

# Get battlefield.json (terrain + mesh data)
curl http://localhost:3001/api/battlefields/battlefield-*.json
```

---

## Code Architecture

### BattlefieldUtils Module

Centralized geometry and distance utilities to eliminate code duplication:

```typescript
import {
  // Geometry primitives
  orientation,
  onSegment,
  segmentsIntersect,
  segmentIntersection,
  polygonsOverlap,
  pointInPolygon,
  
  // Distance calculations
  distance,
  pointToSegmentDistance,
  segmentToSegmentDistance,
  closestDistanceToPolygon,
  segmentDistanceToPolygon,
  polygonsDistance,
  distancePointToRect,
  distancePointToPolygon,
  
  // Segment operations
  segmentPolygonIntersections,
  clipSegmentEnd,
} from './src/lib/mest-tactics/battlefield/terrain/BattlefieldUtils';
```

**Files using BattlefieldUtils:**
- `Battlefield.ts`
- `spatial-rules.ts`
- `action-context.ts`
- `concealment.ts`
- `Pathfinder.ts`
- `BattlefieldFactory.ts`
- `TerrainFitness.ts`
- `PathfindingEngine.ts`
- `LOSOperations.ts`
- `LOFOperations.ts`

**Benefits:**
- ~400 lines of duplicated code eliminated
- Single source of truth for geometry calculations
- Consistent behavior across all modules
- Easier maintenance and bug fixes

---

## Portrait System

Characters are assigned portraits based on species, ancestry, and SIZ:

| Species | Ancestry | SIZ | Sheet |
|---------|----------|-----|-------|
| Humaniki | Alef/Human | 3 | human-quaggkhir-male.jpg (default) |
| Orogulun | Orok | 3 | orugu-common-male.jpg |
| Jhastruj | Jhastra | 2 | lizardfolk-common-male.jpg |
| Gorblun | Golbrini | 2 | golbrini-common-male.jpg |
| Klobalun | Korkbul | 1 | kobolds-common-male.jpg |

**Call Signs:** AA-00 through ZZ-75 (62,400 unique combinations)
- First digit → column (0-7)
- Second digit → row (0-5)
- Example: BA-32 → column 3, row 2

---

## File Structure

```
generated/
├── battlefields/
│   └── battlefield-*.json      # Terrain + mesh data
├── ai-battle-reports/
│   └── battle-report-*/
│       ├── audit.json          # Full battle audit
│       └── battlefield-*.svg   # Battlefield visualization
└── battle-reports/
    └── battle-report-*/
        ├── audit.json
        ├── battlefield.svg
        └── battle-report.html  # Legacy viewer
```

### battlefield.json Schema

```json
{
  "version": "1.0",
  "dimensions": { "width": 24, "height": 24 },
  "terrainTypes": { "Tree": {...}, "Shrub": {...} },
  "terrainInstances": [{ "typeRef": "Tree", "position": {...} }],
  "delaunayMesh": {
    "vertices": [{ "x": 0, "y": 0 }],
    "triangles": [[0, 1, 2]]
  }
}
```

### audit.json Schema

```json
{
  "version": "1.0",
  "session": {
    "missionId": "QAI_11",
    "missionName": "Elimination",
    "lighting": "Day, Clear",
    "visibilityOrMu": 16
  },
  "battlefield": {
    "widthMu": 24,
    "heightMu": 24,
    "exportPath": "../battlefields/battlefield-*.json"
  },
  "turns": [
    {
      "turn": 1,
      "activations": [
        {
          "modelId": "AA-00",
          "modelName": "AA-00",
          "sideName": "Alpha",
          "steps": [{
            "actionType": "move",
            "actorPositionBefore": { "x": 5, "y": 5 },
            "actorPositionAfter": { "x": 9, "y": 5 },
            "success": true,
            "vectors": [{ "kind": "los", "from": {...}, "to": {...} }]
          }]
        }
      ]
    }
  ]
}
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run ai-battle` | Generate AI battle (default: VERY_SMALL) |
| `npm run ai-battle -- VERY_SMALL 50` | Battle with size and density |
| `npm run serve:reports` | Start dashboard server (port 3001) |
| `npm run generate:portraits` | Regenerate portrait demo |
| `npm run validate:user-content` | Validate data/*.json files |
| `npm test` | Run test suite (1844 tests) |

---

## Configuration

### Battle Config Options

```bash
# Game sizes
VERY_SMALL   # 24×24 MU, 3-5 models, 250-350 BP
SMALL        # 36×36 MU, 4-6 models, 400-500 BP
MEDIUM       # 48×48 MU, 6-8 models, 600-800 BP
LARGE        # 60×60 MU, 8-10 models, 900-1100 BP
VERY_LARGE   # 72×72 MU, 16-18 models, 1400-1600 BP

# Density (0-100%)
0    # No terrain
25   # Sparse
50   # Moderate (default)
75   # Dense
100  # Maximum
```

### Example Commands

```bash
# Quick test battle
npm run ai-battle -- VERY_SMALL 25

# Standard battle
npm run ai-battle -- SMALL 50

# Large battle with high density
npm run ai-battle -- LARGE 75

# Very large battle
npm run ai-battle -- VERY_LARGE 50
```

---

## Troubleshooting

### Dashboard Not Loading

```bash
# Check server is running
lsof -i :3001

# Restart server
npm run serve:reports

# Check for generated battles
ls generated/ai-battle-reports/
```

### No Battles in Dropdown

```bash
# Generate a battle first
npm run ai-battle

# Verify files created
ls generated/ai-battle-reports/battle-report-*/audit.json
```

### Overlays Not Showing

1. Check toggle checkboxes in View tab
2. Verify battle has movement actions (for paths)
3. Verify battle has ranged attacks (for LOS/LOF)
4. Check browser console for errors

### Performance Issues

```bash
# For large battles, reduce density
npm run ai-battle -- LARGE 25

# Clear old battles
rm -rf generated/battlefields/*
rm -rf generated/ai-battle-reports/*
```

---

## Testing

### Run Test Suite

```bash
npm test
```

**Expected:** 116 files, 1844 tests passing

### Visual Audit Testing

See `docs/VISUAL_AUDIT_TEST_CHECKLIST.md` for comprehensive testing guide.

Quick test:
```bash
# Generate battle
npm run ai-battle -- VERY_SMALL 50

# Start dashboard
npm run serve:reports

# Open browser and verify:
# 1. Battle appears in Tab 1
# 2. Click → loads in Tab 2
# 3. Paths visible (green/red lines)
# 4. Click action → jumps to turn
# 5. Play/Pause works
# 6. Speed control works
```

---

## Documentation

| Document | Description |
|----------|-------------|
| `docs/VISUAL_AUDIT_TEST_CHECKLIST.md` | Complete testing guide |
| `docs/BATTLEFIELD_DATA_ANALYSIS.md` | battlefield.json architecture |
| `src/guides/docs/rules-portraits.md` | Portrait system rules |
| `blueprint.md` | Full project blueprint |

---

## Project Structure

```
src/
├── lib/
│   ├── mest-tactics/
│   │   ├── battlefield/
│   │   │   ├── BattlefieldExporter.ts   # battlefield.json export
│   │   │   └── rendering/
│   │   │       ├── SvgRenderer.ts        # SVG generation
│   │   │       └── PortraitRenderer.ts   # Portrait rendering
│   │   └── viewer/
│   │       └── audit-dashboard.html      # 4-tab dashboard
│   └── portraits/
│       ├── portrait-clip.ts              # Clip metrics
│       ├── portrait-naming.ts            # Call sign logic
│       └── portrait-sheet-registry.ts    # Species mapping
└── data/                                 # Canonical JSON data

scripts/
├── ai-battle/
│   ├── AIBattleRunner.ts                # Battle execution
│   └── reporting/
│       └── BattleReportWriter.ts        # File output
├── ai-battle-setup.ts                   # CLI entry point
├── serve-terrain-audit.ts               # Dashboard server
└── generate-battle-index.ts             # Index generator

generated/                               # Output directory
├── battlefields/                        # battlefield.json files
├── ai-battle-reports/                   # Audit + SVG
└── battle-reports/                      # Legacy format
```

---

## License

MEST Tactics QSR rules apply. See `src/guides/docs/` for complete rules documentation.
