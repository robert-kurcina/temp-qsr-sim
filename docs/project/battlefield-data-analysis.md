# Battlefield Data Architecture Analysis

**Date:** 2026-02-28  
**Status:** Gap Analysis & Implementation Plan

---

## Current Implementation Status

### ✅ What Exists

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| **Terrain Generation** | `TerrainPlacement.ts` | ✅ Complete | Generates `TerrainFeature[]` with vertices, type, position |
| **Delaunay Mesh** | `Battlefield.ts` (line 389) | ✅ Complete | `Delaunay.from(points)` stored in `navigationMesh` |
| **NavMesh Accessor** | `Battlefield.ts` (line 412) | ✅ Complete | `getNavMesh(): Delaunay<Position> \| null` |
| **Pathfinding Engine** | `PathfindingEngine.ts` | ✅ Complete | Grid + NavMesh hybrid with caching |
| **Grid System** | `PathfindingEngine.ts` | ✅ Complete | Walkable cells, terrain costs, clearance |
| **SVG Renderer** | `SvgRenderer.ts` | ✅ Complete | Renders Delaunay mesh as SVG lines |
| **Audit Service** | `AuditService.ts` | ✅ Complete | Captures model states, actions, vectors |
| **Battle Report** | `BattleReport` interface | ✅ Complete | Full battle JSON output |

---

### ❌ What's Missing

| Component | Status | Gap |
|-----------|--------|-----|
| **battlefield.json** | ❌ Not exported | Terrain placement result is in-memory only |
| **Delaunay mesh export** | ❌ Not serialized | `Delaunay<Position>` object not saved to JSON |
| **Grid weights export** | ❌ Not serialized | Pathfinding grid computed on-demand, not saved |
| **Common terrain type definitions** | ⚠️ Partial | `TerrainPlacement.ts` has local config, not shared |
| **Unified data format** | ❌ Missing | SVG, AI, audit all use different structures |

---

## Your Proposal vs. Current State

### 1. battlefield.json Structure

**Your Proposal:**
```json
{
  "dimensions": { "width": 24, "height": 24 },
  "terrainTypes": {
    "Tree": { "mesh": {...}, "los": "blocking", "movement": "impassable" }
  },
  "terrainLayers": [
    { "typeRef": "Tree", "position": {"x": 10, "y": 10}, "rotation": 45 }
  ],
  "delaunayMesh": {
    "nodes": [{"x": 0, "y": 0, "weight": 1.0}],
    "edges": [{"from": 0, "to": 1, "weight": 1.0}]
  },
  "gridLayer": {
    "resolution": 0.5,
    "cells": [{"walkable": true, "cost": 1.0}]
  }
}
```

**Current State:**
- ✅ `dimensions` — Available in `Battlefield.width/height`
- ❌ `terrainTypes` — Not centralized (defined per-placement in `TerrainPlacement.ts`)
- ⚠️ `terrainLayers` — Exists as `TerrainFeature[]` but not exported
- ❌ `delaunayMesh` — Exists in-memory but not serialized
- ❌ `gridLayer` — Computed on-demand by `PathfindingEngine`, not saved

**Gap:** Need to export battlefield state to JSON file.

---

### 2. SVG Generator Uses battlefield.json

**Your Proposal:** SVG renderer loads `battlefield.json` and renders layers.

**Current State:**
- ✅ `SvgRenderer.render(battlefield, options)` — Takes `Battlefield` object
- ✅ `SvgRenderer.renderDelaunay(mesh, layers)` — Renders mesh from `battlefield.getNavMesh()`
- ❌ Does NOT load from JSON file — renders from in-memory `Battlefield` object

**Gap:** SVG renderer would need to accept JSON input OR battlefield.json needs to be loaded into `Battlefield` object.

**Assessment:** Current approach (render from in-memory object) is fine. The issue is that `battlefield.json` isn't being created.

---

### 3. Visual Audit / Terrain Audit Tabs Load SVG

**Your Proposal:** Dashboard tabs load battlefield SVG with layer flyout.

**Current State:**
- ✅ Dashboard Tab 1 (Battlefields) — Shows SVG previews
- ✅ Dashboard Tab 2 (Visual Audit) — Loads SVG with layer toggles
- ✅ Layer toggles — Paths, LOS, LOF, **Delaunay**, Grid, Deployment
- ❌ SVG loaded from file system — Not linked to `battlefield.json`

**Assessment:** ✅ **Already implemented.** The SVG already contains the Delaunay mesh (as `<line class="delaunay-line">` elements) and can be toggled.

---

### 4. AI System Workflow

**Your Proposal:**
```
AI loads battlefield.json
  → Builds profiles/assemblies/sides → audit.json
  → Deploys models → audit.json
  → Resolves battle play-by-play → audit.json
```

**Current State:**
- ❌ `battlefield.json` — Doesn't exist
- ✅ `audit.json` — Created by `AuditService` with:
  - Session info (mission, lighting, visibility)
  - Battlefield dimensions
  - Turn-by-turn activations
  - Model states
  - Action vectors (movement, LOS, LOF)
- ✅ Profiles/Assemblies/Sides — Built by `buildProfile()`, `buildAssembly()`, `buildMissionSide()`
- ✅ Model deployment — Part of battle setup, included in audit
- ✅ Play-by-play resolution — Full audit trail captured

**Gap:** `battlefield.json` needs to be created and linked to audit.

---

## Implementation Plan

### Phase 1: Export battlefield.json (HIGH PRIORITY)

**Goal:** Create `battlefield.json` during terrain generation.

**Files to Modify:**
1. `TerrainPlacement.ts` — Add export function
2. `Battlefield.ts` — Add serialization method
3. `PathfindingEngine.ts` — Add grid export method
4. `AIBattleRunner.ts` — Call export after terrain generation

**New File:**
- `src/lib/mest-tactics/battlefield/BattlefieldExporter.ts`

**Schema:**
```typescript
interface BattlefieldExport {
  version: string;
  dimensions: { width: number; height: number };
  terrainTypes: Record<string, TerrainTypeInfo>;
  terrainInstances: TerrainInstance[];
  delaunayMesh: {
    vertices: { x: number; y: number }[];
    triangles: [number, number, number][];
  };
  grid?: {
    resolution: number;
    width: number;
    height: number;
    cells: { walkable: boolean; cost: number }[];
  };
  stats: PlacementStats;
  fitness: TerrainFitnessReport;
}
```

**Estimated:** 4-6 hours

---

### Phase 2: Link battlefield.json to audit.json (MEDIUM PRIORITY)

**Goal:** Include battlefield reference in audit.

**Files to Modify:**
1. `AuditService.ts` — Add `battlefieldRef` field
2. `AIBattleRunner.ts` — Pass battlefield path to audit

**Changes:**
```typescript
// In audit.json
{
  "version": "1.0",
  "battlefield": "generated/battle-reports/battle-report-*/battlefield.json",
  "session": { ... },
  "turns": [ ... ]
}
```

**Estimated:** 1-2 hours

---

### Phase 3: Dashboard Loads battlefield.json (MEDIUM PRIORITY)

**Goal:** Dashboard loads both SVG and battlefield.json for enhanced visualization.

**Files to Modify:**
1. `audit-dashboard.html` — Fetch battlefield.json
2. `audit-dashboard.html` — Use mesh data for path overlay
3. `audit-dashboard.html` — Use grid data for cell highlighting

**Features Enabled:**
- Path overlay (uses grid weights)
- LOS/LOF overlay (uses mesh vertices)
- Cell cost visualization (uses grid costs)

**Estimated:** 4-6 hours

---

### Phase 4: AI Uses battlefield.json (LOW PRIORITY)

**Goal:** AI can load pre-generated battlefield instead of generating.

**Files to Modify:**
1. `AIBattleRunner.ts` — Add `loadBattlefield()` option
2. `Battlefield.ts` — Add static `fromJSON()` method

**Use Case:**
```bash
# Reuse same battlefield for multiple battles
npm run sim -- quick --battlefield generated/battlefield-*.json
```

**Estimated:** 3-4 hours

---

## Summary: What's Moving vs. What's New

### Moving Around (Existing Data, New Format)

| Data | Current Location | New Location | Effort |
|------|-----------------|--------------|--------|
| Dimensions | `Battlefield.width/height` | `battlefield.json.dimensions` | 1 hour |
| Terrain instances | `TerrainFeature[]` | `battlefield.json.terrainInstances` | 2 hours |
| Delaunay vertices | `Delaunay.points` | `battlefield.json.delaunayMesh.vertices` | 2 hours |
| Grid cells | `PathfindingEngine` cache | `battlefield.json.grid` | 3 hours |

### New Code (Not Currently Existent)

| Feature | Files | Effort |
|---------|-------|--------|
| `BattlefieldExporter.ts` | New file | 3 hours |
| `battlefield.json` schema | New file (JSON Schema) | 1 hour |
| Dashboard battlefield.json loader | `audit-dashboard.html` | 2 hours |
| Path overlay using grid data | `audit-dashboard.html` | 3 hours |
| LOS/LOF overlay using mesh data | `audit-dashboard.html` | 3 hours |

**Total New Code:** ~12 hours  
**Total Refactoring:** ~8 hours  
**Total:** ~20 hours

---

## Recommendation

**Start with Phase 1** (Export battlefield.json). This unblocks:
- Consistent battlefield data across SVG/AI/audit
- Path/LOS/LOF visualization in dashboard
- Battlefield reuse for testing

**Phase 2-3** can follow as time permits.

**Phase 4** (AI loading) is optional — only needed if you want to reuse battlefields.
