# Phase A0 (P0-HIGH): Visual Audit API & Interactive HTML Viewer

**Source:** Extracted from `/Users/kitrok/projects/temp-qsr-sim/blueprint.md` (Lines 1387-1640)  
**Extraction Date:** 2026-03-02

---

**Status:** ✅ **COMPLETE** (2026-02-28)

**Priority:** **P0-HIGH** - Required before Web UI (enables battle replay/visualization)

**Objective:** Produce a deterministic, model-by-model timeline API that drives an interactive HTML/SVG battle report viewer with timeline controls (Stop, Play, Step Back, Step Forward, Turn slider).

### Completed Features

**Audit Capture:**
- ✅ Turn-by-turn audit capture
- ✅ Activation-level audit (AP, wait, delay tokens)
- ✅ Action step capture (action type, positions, state changes)
- ✅ Decision reasoning (AI scoring explanation)
- ✅ Initiative tracking (via logger)
- ✅ Model state snapshots (wounds, tokens, status)

**Export Modules:**
- ✅ `BattleAuditExporter.ts` - Export audit data
- ✅ `DeploymentExporter.ts` - Export deployment data
- ✅ `AuditCaptureService.ts` - Game loop audit hooks

**Viewer:**
- ✅ HTML viewer with timeline controls
- ✅ Layer flyout (grid, terrain, deployment, etc.)
- ✅ Action log display
- ✅ Token display (wound, delay, fear, etc.)
- ✅ Model rendering with positions

**Scripts:**
- ✅ `npm run sim -- quick` - Quick battles (basic audit)
- ✅ `npm run sim -- quick --audit --viewer` - Quick battles with viewer
- ✅ `npm run sim -- quick --audit --viewer` - Full battles (detailed audit)
- ✅ `npm run sim:serve-reports` - Serve battle reports on port 3001

### Audit Data Structure

```typescript
{
  version: "1.0",
  session: { missionId, missionName, seed, lighting, visibilityOrMu, ... },
  battlefield: { widthMu, heightMu, ... },
  turns: [
    {
      turn: 1,
      activations: [
        {
          modelId: "Alpha-1",
          apStart: 2,
          apEnd: 1,
          steps: [
            {
              actionType: "move",
              decisionReason: "Best action (score: 30.16...)",
              apBefore: 2,
              apAfter: 1,
              actorPositionBefore: { x: 5, y: 3 },
              actorPositionAfter: { x: 6, y: 3 },
              actorStateBefore: { wounds: 0, delayTokens: 0, ... },
              actorStateAfter: { wounds: 0, delayTokens: 0, ... }
            }
          ]
        }
      ]
    }
  ],
  terrain: [...],
  deployment: [...]
}
```

### Output Structure

```
generated/battle-reports/battle-report-TIMESTAMP/
├── battlefield.svg         # Terrain visualization
├── audit.json              # Full battle audit (turn-by-turn with action steps)
├── deployment.json         # Deployment data
└── battle-report.html      # Interactive viewer
```

### Test Results

- ✅ 1844 tests passing
- ✅ Audit capture verified with `npm run sim -- quick --audit --viewer`
- ✅ Action steps populated with full details
- ✅ No regressions introduced

### Asset Integration Strategy

**1. Character Portraits (`assets/portraits/`)**
- **Species:** 11 species/ancestry combinations (Humaniki, Orogulun, Jhastruj, Gorblun, Klobalun)
- **Default:** Human Quaggkhir Male (SIZ 3) — use `human-quaggkhir-male.jpg` portrait sheet
- **Portrait Sheet:** 8 columns × 6 rows on 1920×1920 canvas (48 portraits per sheet)
- **Clip Anchor:** Defined in `human-quaggkhir-male-example-clip.svg`
  - `centerX = 168.48 + col × 225.01`
  - `centerY = 456.87 + row × 223.55`
  - `radius = 94.13`
- **Call Signs:** `AA-00` to `ZZ-75` → column/row indices (0-based)
- **Existing Utility:** `src/lib/portraits/portrait-clip.ts` exports `getClipMetrics()`
- **For Visual Audit:** Circular-clipped portraits (30mm diameter for SIZ 3) instead of colored circles
- **Lower Priority:** Sophont (species) and gender/sex selection

**2. Status Tokens (`assets/svg/tokens/`)**
- **Token Types (12 total):**
  - Status: `wound-token.svg`, `fear-token.svg`, `delay-token.svg`, `hidden-marker.svg`
  - Markers: `done-marker.svg`, `wait-marker.svg`, `out-of-ammo-marker.svg`
  - Combat State: `knocked-out-marker-triangle.svg`, `eliminated-marker-triangle.svg`
  - Resources: `victory-point-token.svg`, `initiative-point-token.svg`, `initiative-card-back.svg`
- **Display:** Radial arrangement around model base (see `assets/sample-token-placement.jpg`)
- **Interaction:** Show on hover/click, toggle to always display (low priority)
- **Animation:** Fade in/out on apply/remove

**3. Terrain SVGs (`assets/svg/terrain/`)**
- **Buildings:** `building-small-4x6.svg`, `building-medium-6x8.svg`
- **Rocks:** `rocky-small.svg`, `rocky-medium.svg`, `rocky-large.svg`
- **Shrubs:** `shrub-single.svg`, `shrub-clump.svg`, `shrub-cluster.svg`
- **Trees:** `tree-single.svg`, `tree-cluster.svg`, `tree-stand.svg`, `tree-grove.svg`
- **Priority:** Lower (2D UI enhancement, replace default terrain polygons)

**4. Scatter Diagram (`assets/svg/misc/scatter.svg`)**
- **Purpose:** Advanced rules for Indirect Ranged Attacks and [Scatter] trait
- **Usage:** Display scatter direction/distance determination
- **Priority:** Lower (Advanced rules, not QSR core)

---

### Current Implementation:
- ✅ Audit payload in `scripts/ai-battle-setup.ts` battle report JSON
- ✅ Includes: turn/activation/action-step, AP spend, vectors, interactions, opposed tests, before/after state
- ✅ Asset library available (portraits, tokens, terrain SVGs)
- ❌ SVG animation keyframe mapper not implemented
- ❌ Audit logic only in script scope (needs promotion to shared service)
- ❌ Interactive HTML viewer not implemented

---

### Required Work:

#### 1. Extract Audit Logic to Shared Service
- Move audit building logic from `scripts/ai-battle-setup.ts` to `src/lib/mest-tactics/audit/`
- Create `AuditService` class with methods:
  - `startTurn(turn: number)` — Begin turn audit
  - `startActivation(activation: ActivationAudit)` — Begin activation audit
  - `recordAction(action: ActionStepAudit)` — Record action step
  - `endActivation()` — Complete activation audit
  - `endTurn()` — Complete turn audit
  - `getAudit()` — Return complete audit payload
  - `getModelState()` — Snapshot of all model positions + status tokens

#### 2. SVG Animation Keyframe Mapper
- **File:** `src/lib/mest-tactics/battlefield/rendering/SvgAnimationMapper.ts`
- Convert `audit` JSON into SVG animation keyframes:
  - Movement arrow frames (0.5 MU cadence)
  - LOS/LOF line frames (animated dashes)
  - Action/interactions/opposed-test overlay events
  - Status token apply/remove events
- Generate static SVG battlefield with:
  - Terrain features (SVG icons or polygons)
  - Model portraits (circular-clipped from portrait sheets)
  - Token placeholders (positioned radially around bases)

#### 3. Interactive HTML Viewer
- **File:** `src/lib/mest-tactics/viewer/battle-report-viewer.html`
- **Timeline Controls:**
  - ⏹ **Stop** — Reset to Turn 1, Activation 0
  - ⏯ **Play/Pause** — Toggle animation (1-2 sec per activation)
  - ⏮ **Step Back** — Previous activation
  - ⏭ **Step Forward** — Next activation
  - 🎚 **Turn Slider** — Scrub through turns (1–N)
- **Display Panels:**
  - Current Turn/Activation — "Turn 3, Side A Activation 2"
  - AP Spent — Show action point expenditure
  - Action Log — Scrollable list: "Model A moved 4 MU → Model B"
  - Test Results — "CCA Test: 3 successes vs 1 success (Hit!)"
- **Model Interaction:**
  - Hover portrait → Highlight model, show call sign + profile
  - Click portrait → Show detailed stats (attributes, traits, wounds)
  - Hover token → Show tooltip with status description
  - Toggle → Always show tokens (checkbox)

#### 4. JavaScript Player Engine
- **File:** `src/lib/mest-tactics/viewer/battle-report-player.js`
- **Class:** `BattleReportPlayer`
  - `constructor(frames, svgElement)` — Initialize with frame data
  - `play()` — Start interval-based playback
  - `pause()` — Stop playback
  - `stepForward()` — Advance one frame
  - `stepBack()` — Rewind one frame
  - `goToTurn(turn)` — Jump to turn start
  - `renderFrame(index)` — Update SVG model positions + tokens
  - `interpolatePositions(from, to, progress)` — Smooth animation
- **Frame Interpolation:**
  - Linear interpolation for movement paths
  - Fade transitions for token visibility
  - CSS transitions for smooth visual updates

#### 5. Integrate with GameManager
- GameManager uses AuditService during game loop
- Maintain backward compatibility with existing battle report JSON format
- Add CLI flag `--audit` to enable/disable audit logging (performance)
- Add CLI flag `--viewer` to generate HTML viewer (default: true)

---

### Exit Criteria:
- [ ] Audit logic extracted to `src/lib/mest-tactics/audit/` module
- [ ] `AuditService` class implemented with full API
- [ ] GameManager integrated with AuditService
- [ ] SvgAnimationMapper generates static SVG + frame data
- [ ] HTML viewer with all 5 timeline controls
- [ ] JavaScript player engine handles playback + interpolation
- [ ] Portrait clipping integrated (circular masks from portrait sheets)
- [ ] Token display system (radial arrangement, hover tooltips)
- [ ] Battle report JSON format unchanged (backward compatible)
- [ ] Unit tests for AuditService (10+ tests)
- [ ] Manual test: Open HTML in browser, scrub through battle
- [ ] UI can consume audit data without running full battle simulation

---

### Output Structure:
```
generated/
└── battle-reports/
    ├── battle-20260227-123456/
    │   ├── audit.json              # Full audit data
    │   ├── battle-report.html      # Interactive viewer
    │   ├── battle-report.svg       # Static SVG (fallback)
    │   ├── frames.json             # Pre-computed frame data
    │   └── portraits.json          # Portrait clip metrics per model
    └── index.json                  # List of all reports
```

---

### Estimated Effort: 2-3 days
- **Day 1:** AuditService + GameManager integration
- **Day 2:** SvgAnimationMapper + HTML viewer template
- **Day 3:** Player engine + portrait/token integration + testing

---

### Rationale: Visual Audit API enables:
- **Battle replay** without interactive UI or re-simulation
- **Automated AI behavior validation** via visual inspection
- **Shareable battle reports** with interactive animation
- **Foundation for future Web UI** (Phase 3)
- **QSR compliance auditing** — visually verify rule execution
- **Tutorial/replay value** — share notable battles with community

---

## Document Index

| File | Description |
|------|-------------|
| [../../blueprint.md](../../blueprint.md) | Master blueprint document |
| [../01-overview.md](../01-overview.md) | Overview, Operating Principles, Environment |
| [../02-game-docs.md](../02-game-docs.md) | Game Documentation, Implementation Details |
| [../03-current-task.md](../03-current-task.md) | Current Task, Gaps, Prioritized Plan |
| [phase-0-qsr-rules.md](phase-0-qsr-rules.md) | Phase 0: QSR Rules Gap Closure |
| [phase-1-engine.md](phase-1-engine.md) | Phase 1: Core Engine Stability |
| [phase-2-ai-foundation.md](phase-2-ai-foundation.md) | Phase 2: AI Foundation |
| [phase-2-subphases.md](phase-2-subphases.md) | Phase 2.1-2.7: AI Sub-phases |
| [phase-3-ai-tactical.md](phase-3-ai-tactical.md) | Phase 3: AI Tactical Intelligence |
| [phase-4-validation.md](phase-4-validation.md) | Phase 4: Validation & Testing |
| [phase-a0-visual-audit.md](phase-a0-visual-audit.md) | **This file** — Phase A0: Visual Audit API |
| [phase-r-terrain.md](phase-r-terrain.md) | Phase R: Terrain Placement Refactoring |
| [phase-s-consolidation.md](phase-s-consolidation.md) | Phase S: Battle Script Consolidation |
| [future-phases.md](future-phases.md) | Future Phases (I+) |
