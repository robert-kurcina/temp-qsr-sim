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

## AI Layer Highlights (2026-03)

Recent AI updates added stronger coordination and lower-overhead decision filtering:

- **Side-level target commitments**
  - `SideAICoordinator` now tracks decaying focus-fire commitments per target.
  - Coordinator also tracks decaying continuity channels:
    - scrum continuity (`close_combat`/`charge`)
    - lane pressure (`ranged_combat`)
  - Commitments are injected into per-activation `AIContext` and influence target scoring.
  - Commitments clear automatically when targets become KO'd or Eliminated.

- **Coordinator high-level decision trace**
  - Side coordinators now emit bounded per-turn observation/response traces.
  - Trace includes VP/key context, top opponent pressure keys, commitment snapshot, and directive priority.
  - Trace now includes fractional VP potential snapshot and a potential directive (`expand`, `deny`, `protect`, `balanced`).
  - Trace now includes top scrum/lane continuity pressure and a pressure directive (`maintain_scrum_pressure`, `maintain_lane_pressure`, `mixed_pressure`, `no_pressure_lock`).
  - Trace is serialized into `BattleReport.sideStrategies` for post-battle reasoning audit.

- **Action-legality mask memoization**
  - `UtilityScorer` now caches action-legality masks keyed by actor state, local tactical signature, terrain version, and AP.
  - Cached masks gate expensive action evaluation paths (target scoring, move sampling, support/swap/wait checks).
  - Public cache instrumentation:
    - `getActionMaskCacheStats()`
    - `clearActionMaskCache()`

- **Minimax-lite bounded re-ranking**
  - `CharacterAI` now applies a bounded minimax-lite pass on top utility candidates.
  - Node evaluation is patch-aware (friendly/enemy dominant, contested, scrum, objective, lane pressure).
  - Configurable caps:
    - `enableMinimaxLite`
    - `minimaxLiteDepth` (currently capped at 2)
    - `minimaxLiteBeamWidth`
    - `minimaxLiteOpponentSamples`
  - Includes a bounded transposition cache for repeated node evaluations:
    - `getMinimaxLiteCacheStats()`
    - `clearMinimaxLiteCache()`
  - Transposition keys now include a compact tactical state signature:
    - projected ally/enemy occupancy
    - engagement pressure around actor
    - LOS/cover bits against top nearby threats
    - objective control/carrier state
  - Node evaluation now blends lightweight tactical state transitions:
    - projected wound/out-of-play BP swing
    - sampled opponent reply simulation
    - simulated follow-up potential
  - Hard legality gating is applied before final action selection:
    - rejects unengaged `close_combat` targets
    - rejects impossible over-range `move` destinations
    - rejects invalid ranged attacks (engaged attacker/no in-range ranged option)
  - Cache telemetry now includes node evaluation volume and patch transition counts.

- **BP-aware fractional out-of-play scoring**
  - Target scoring includes BP-scaled fractional pressure for enemy models approaching out-of-play.
  - Self-preservation adds BP-scaled risk penalties from wounds/exposure/engagement.
  - Action scoring now includes fractional VP/RP potential and denial pressure terms.
  - Target factor outputs now include:
    - `targetCommitment`
    - `scrumContinuity`
    - `lanePressure`
    - `outOfPlayPressure`
    - `selfOutOfPlayRisk`

- **Validation regression gates**
  - Coordinator trace coverage gates validate run/turn/side-level trace completeness.
  - Combat activity gates track attack-action ratio and zero-attack run rate with mission+size+density-aware profiles.
  - Combat gates are turn-horizon aware to avoid false failures on short smoke runs (`AI_BATTLE_COMBAT_ACTIVITY_MIN_TURN_RATIO`).
  - Passiveness gates track detect/hide/wait-heavy behavior with mission+size+density-aware thresholds.
  - Performance gates now also track minimax-lite transposition cache hit rate (`AI_BATTLE_GATE_MINIMAX_HIT_MIN`).

- **Runtime parity across AI loops**
  - Commitment injection/update is wired in both:
    - `scripts/ai-battle/AIBattleRunner.ts`
    - `src/lib/mest-tactics/ai/executor/AIGameLoop.ts`

---

## Quick Start

### Run a Battle

```bash
# Generate AI battle with default settings (universal entry point)
npm run sim

# Generate with specific settings
npm run sim -- quick VERY_SMALL 50

# Generate with audit and viewer
npm run sim -- quick --audit --viewer
```

### Open Dashboard

```bash
# Start dashboard server
npm run sim:serve-reports

# Open in browser
http://localhost:3001/dashboard
```

### Calibrate Validation Gates

```bash
# Summarize validation reports and print threshold suggestions by mission/size profile
npm run sim:calibrate

# Optional: include shorter runs by lowering horizon filter
npx tsx scripts/ai-battle/validation/BenchmarkSummary.ts --min-horizon 0.5 generated/ai-battle-reports
```

---

## Battle Audit Dashboard 🎬

**5-tab interface for battle analysis and battlefield generation**

### Tab 1: 🗺️ Battlefield Generator

**Interactive battlefield generation with terrain density controls:**

| Control | Description | Options |
|---------|-------------|---------|
| **Battlefield Size** | Select battlefield dimensions | VERY_SMALL (18×24), SMALL (24×24), MEDIUM (36×36), LARGE (48×48), VERY_LARGE (72×48) |
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
| `npm run sim -- [command] [args...]` | Universal simulation entry point (`quick` default) |
| `npm run sim -- help` | Print all `sim` subcommands and usage |
| `npm run sim -- quick [SIZE] [DENSITY] [--audit] [--viewer]` | Canonical quick battle execution (`AIBattleRunner`) |
| `npm run sim -- interactive` | Interactive setup flow |
| `npm run sim -- validate SIZE DENSITY RUNS SEED [LIGHTING] [...]` | Validation batch runs |
| `npm run sim -- render-report <report.json>` | Human-readable report render from saved JSON |
| `npm run sim -- serve-reports` | Start dashboard server (port 3001) |
| `npm run sim:quick -- [args...]` | Shortcut for `sim quick` |
| `npm run sim:interactive` | Shortcut for `sim interactive` |
| `npm run sim:validate -- [args...]` | Shortcut for `sim validate` |
| `npm run sim:render-report -- <report.json>` | Shortcut for `sim render-report` |
| `npm run sim:serve-reports` | Shortcut for `sim serve-reports` |
| `npm run sim:calibrate` | Summarize validation reports and print gate threshold suggestions |
| `npm run battlefield:generate -- VERY_SMALL A20 B40 W0 R20 S0 T0` | Generate reusable battlefield JSON+SVG under `data/battlefields/generated/{gameSize}` using layer tokens (A/B/W/R/S/T), quantized to nearest 20 |
| `npm run battlefield:defaults` | Generate default empty battlefield JSON+SVG set under `data/battlefields/default/simple` |
| `npm run battlefield:svg` | Render SVG files from battlefield JSON data under `data/battlefields/default/simple` and `data/battlefields/generated` |
| `npm run generate:portraits` | Regenerate portrait demo |
| `npm run validate:user-content` | Validate data/*.json files |
| `npm test` | Run test suite (1844 tests) |

### Comprehensive `sim` Invocation

```bash
# Show help
npm run sim -- help

# Quick battle (default command if omitted)
npm run sim -- quick VERY_SMALL 50 --audit --viewer --seed 424242
npm run sim -- VERY_SMALL 50 --audit --viewer --seed 424242

# Interactive setup
npm run sim -- interactive

# Validation batch
npm run sim -- validate VERY_SMALL 50 3 424242

# Render an existing report
npm run sim -- render-report generated/ai-battle-reports/battle-report-<ts>.json

# Start report dashboard server
npm run sim -- serve-reports
```

Compatibility note:
- Legacy compatibility subcommands (`battle`, `run-battles`, `terrain-only`) were removed from `sim`.
- Use `quick`, `interactive`, `validate`, `render-report`, and `serve-reports`.

### Battlefield Data Directories

- Default simple battlefields:
  - `data/battlefields/default/simple`
- Generated battlefields by game size:
  - `data/battlefields/generated/{gameSize}`
- `sim quick` supports loading a pre-generated battlefield via:
  - `--battlefield <path-to-battlefield.json>`
- If `--battlefield` is not provided, quick flow attempts to load a matching default simple battlefield for the selected game size from:
  - `data/battlefields/default/simple`

---

## Configuration

### Battle Config Options

```bash
# Game sizes (Width × Height in MU)
# Note: Rectangular battlefields display with longer dimension left-to-right
VERY_SMALL   # 18×24 MU, 2-4 models, 125-250 BP (rectangular)
SMALL        # 24×24 MU, 4-8 models, 250-500 BP (square)
MEDIUM       # 36×36 MU, 6-12 models, 500-750 BP (square)
LARGE        # 48×48 MU, 8-16 models, 750-1000 BP (square)
VERY_LARGE   # 72×48 MU, 10-20 models, 1000-1250 BP (rectangular)

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
npm run sim -- quick VERY_SMALL 25

# Standard battle
npm run sim -- quick SMALL 50

# Large battle with high density
npm run sim -- quick LARGE 75

# Very large battle
npm run sim -- quick VERY_LARGE 50
```

---

## Troubleshooting

### Dashboard Not Loading

```bash
# Check server is running
lsof -i :3001

# Restart server
npm run sim:serve-reports

# Check for generated battles
ls generated/ai-battle-reports/
```

### No Battles in Dropdown

```bash
# Generate a battle first
npm run sim:quick

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
npm run sim -- quick LARGE 25

# Clear old battles
rm -rf data/battlefields/generated/*
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
npm run sim -- quick VERY_SMALL 50

# Start dashboard
npm run sim:serve-reports

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
├── sim.ts                              # Universal simulation entry point
├── ai-battle/
│   ├── AIBattleRunner.ts                # Battle execution
│   └── reporting/
│       └── BattleReportWriter.ts        # File output
├── ai-battle-setup.ts                   # CLI entry point
├── serve-terrain-audit.ts               # Dashboard server
└── generate-battle-index.ts             # Index generator

data/battlefields/
├── default/simple/                      # Default empty battlefields
└── generated/{gameSize}/                # Generated battlefield.json + SVG

generated/                               # Runtime output directory
├── ai-battle-reports/                   # Audit + SVG
└── battle-reports/                      # Legacy format
```

---

## License

MEST Tactics QSR rules apply. See `src/guides/docs/` for complete rules documentation.
