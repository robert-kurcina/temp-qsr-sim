# Visual Audit System - Test Checklist

**Date:** 2026-02-28  
**Version:** 1.0 (Complete)

---

## Quick Start

```bash
# 1. Generate a battle
npm run ai-battle -- VERY_SMALL 50

# 2. Start dashboard server
npm run serve:reports

# 3. Open in browser
http://localhost:3001/dashboard
```

---

## Tab 1: Battlefields

### Test: Battle Grid Display
- [ ] Battles appear in grid layout
- [ ] SVG previews load correctly
- [ ] Battle metadata displays (date, size, turns, winner)
- [ ] Click battle card → opens in Visual Audit tab

**Expected:** Grid of battle cards with SVG thumbnails

---

## Tab 2: Visual Audit

### Test: Battle Selection
- [ ] Battle dropdown populates with available battles
- [ ] Selecting battle loads SVG battlefield
- [ ] Turn slider shows correct max turns
- [ ] Action log populates with actions

**Expected:** Battlefield SVG with turn controls and action log

---

### Test: Path Overlay (Green/Red Lines)
- [ ] Green lines show successful movement
- [ ] Red lines show failed movement
- [ ] Direction arrows appear at midpoint
- [ ] "Show Paths" checkbox toggles visibility
- [ ] Paths layer appears above terrain, below LOS

**Test Steps:**
1. Select battle with movement actions
2. Verify green path lines visible
3. Uncheck "Show Paths" → paths disappear
4. Recheck → paths reappear

**Expected:** Movement paths overlaid on battlefield

---

### Test: LOS Overlay (Blue/Red Dashed Lines)
- [ ] Blue dashed lines = clear LOS
- [ ] Red dashed lines = blocked LOS
- [ ] "Show LOS" checkbox toggles visibility
- [ ] Lines appear during ranged attacks

**Note:** LOS capture requires `perCharacterFovLos: true` in battle config

**Expected:** LOS check lines during ranged combat

---

### Test: LOF Overlay (Purple Dashed Lines)
- [ ] Purple dashed lines = LOF arcs
- [ ] "Show LOF" checkbox toggles visibility
- [ ] Line width indicates weapon LOF width

**Expected:** LOF arcs during ranged attacks

---

### Test: Delaunay Mesh Toggle
- [ ] Blue mesh lines visible by default
- [ ] "Show Delaunay Mesh" checkbox toggles visibility
- [ ] Mesh shows pathfinding triangles

**Expected:** Triangular mesh overlay for navigation

---

### Test: Grid Toggle
- [ ] Grid lines visible by default
- [ ] "Show Grid" checkbox toggles visibility
- [ ] Grid shows 0.5 MU cells

**Expected:** Grid overlay for measurement

---

### Test: Deployment Zones Toggle
- [ ] Deployment zones visible by default
- [ ] "Show Deployment" checkbox toggles visibility
- [ ] Zones show starting areas

**Expected:** Colored deployment zone overlays

---

### Test: Model Roster
- [ ] Model portraits appear in grid
- [ ] Call signs displayed on portraits
- [ ] Click portrait → highlights selected
- [ ] Stats tab opens automatically
- [ ] Model stats panel shows:
  - Call Sign
  - Name
  - Side
  - Total AP Spent
  - Action breakdown

**Test Steps:**
1. Click model portrait
2. Verify stats panel appears
3. Verify action breakdown lists all actions

**Expected:** Model stats with action history

---

### Test: Click Action → Jump to Turn
- [ ] Action log entries are clickable
- [ ] Click action → turn slider updates
- [ ] Click action → model highlighted
- [ ] Click action → stats panel shown
- [ ] Click action → log scrolls to keep entry visible
- [ ] Failed actions have red border
- [ ] Active entry has green border (4px)

**Test Steps:**
1. Find action in log (e.g., "Turn 3: Alpha - AA-01: move")
2. Click the action entry
3. Verify turn slider jumps to Turn 3
4. Verify model AA-01 highlighted
5. Verify stats panel shows AA-01

**Expected:** Instant navigation to selected action

---

### Test: Timeline Controls
- [ ] ⏹ Stop → resets to Turn 1
- [ ] ⏯ Play → advances turns automatically
- [ ] ⏮ Prev → goes to previous turn
- [ ] ⏭ Next → goes to next turn
- [ ] Turn slider drags to scrub through turns
- [ ] Turn display shows current turn number

**Test Steps:**
1. Click Play button
2. Watch turns advance automatically
3. Click Pause button
4. Click Stop button → returns to Turn 1

**Expected:** Full playback controls functional

---

### Test: Speed Control
- [ ] Speed dropdown shows: 0.25x, 0.5x, 1x, 2x, 4x
- [ ] Default speed is 1x
- [ ] Change speed → playback adjusts
- [ ] 0.25x = 4 seconds per turn (slow)
- [ ] 4x = 0.25 seconds per turn (fast)

**Test Steps:**
1. Set speed to 0.25x
2. Click Play → verify slow advancement
3. Set speed to 4x
4. Click Play → verify fast advancement

**Expected:** Playback speed adjusts correctly

---

### Test: Layer Stack Order
Verify layers render in correct order (bottom to top):
1. [ ] Terrain (area, buildings, trees)
2. [ ] Grid
3. [ ] Deployment zones
4. [ ] Delaunay mesh
5. [ ] Paths (green/red lines)
6. [ ] LOS/LOF (blue/red/purple dashed)

**Expected:** Overlays appear above terrain, not hidden

---

## Tab 3: Summary

### Test: Battle Summaries
- [ ] Summaries appear in card layout
- [ ] Each card shows:
  - Mission name + timestamp
  - Winner
  - Turns
  - Total actions
  - Game size
- [ ] "View Full Summary" button works
- [ ] Modal shows executive summary
- [ ] Modal shows statistics table
- [ ] Modal shows MVP info
- [ ] Modal shows key moments

**Expected:** Human-readable battle summaries

---

## Tab 4: Portraits

### Test: Portrait Sheet Review
- [ ] All 11 portrait sheets displayed
- [ ] Each card shows:
  - Sheet name
  - Preview image
  - Species
  - SIZ (with mm conversion)
  - Grid info (8×6 = 48 portraits)
- [ ] Default sheet marked
- [ ] Missing images show fallback

**Expected:** Grid of portrait sheet reference cards

---

## battlefield.json Export

### Test: File Generation
- [ ] `generated/battlefields/` directory created
- [ ] `battlefield-*.json` files generated
- [ ] File contains:
  - version
  - dimensions
  - terrainTypes
  - terrainInstances
  - delaunayMesh (vertices + triangles)

**Test Steps:**
1. Run battle
2. Check `generated/battlefields/` directory
3. Open JSON file
4. Verify structure matches schema

**Expected:** ~4-8 KB JSON files with battlefield data

---

### Test: audit.json Reference
- [ ] audit.json includes `battlefield.exportPath`
- [ ] Path points to battlefield.json file
- [ ] Path is relative or absolute

**Test Steps:**
1. Open `generated/ai-battle-reports/battle-report-*/audit.json`
2. Search for `"exportPath"`
3. Verify path is valid

**Expected:** `"exportPath": "../battlefields/battlefield-*.json"`

---

## Performance Tests

### Test: Large Battle Loading
- [ ] Generate LARGE battle (60×60 MU, 8-10 models/side)
- [ ] Load in dashboard
- [ ] SVG renders in < 2 seconds
- [ ] Overlays render in < 1 second
- [ ] No browser freezing

**Test Command:**
```bash
npm run ai-battle -- LARGE 50
```

**Expected:** Smooth loading even for large battles

---

### Test: Many Battles
- [ ] Generate 10+ battles
- [ ] Open dashboard
- [ ] Battle dropdown populates
- [ ] Tab 1 grid shows all battles
- [ ] No performance degradation

**Test Command:**
```bash
for i in {1..10}; do
  npm run ai-battle -- VERY_SMALL 50 2>&1 > /dev/null
done
```

**Expected:** Dashboard handles many battles gracefully

---

## Bug Reporting Template

If you find issues, report with:

```markdown
**Feature:** [e.g., Path overlay, Click action → jump]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected:** [What should happen]

**Actual:** [What actually happened]

**Browser:** [Chrome/Firefox/Safari version]

**Battle Config:** [game size, density, seed if applicable]

**Console Errors:** [Copy from browser dev tools]

**Screenshot:** [If applicable]
```

---

## Sign-Off Checklist

- [ ] Tab 1: Battlefields - All tests pass
- [ ] Tab 2: Visual Audit - All tests pass
- [ ] Tab 3: Summary - All tests pass
- [ ] Tab 4: Portraits - All tests pass
- [ ] battlefield.json export - All tests pass
- [ ] Performance - Large battles load smoothly
- [ ] Performance - Many battles handled gracefully

**Tested by:** ________________  
**Date:** ________________  
**Status:** [ ] PASS  [ ] FAIL  [ ] PARTIAL

---

## Known Limitations

1. **LOS/LOF vectors** only captured when `perCharacterFovLos: true` in battle config
2. **Path overlay** uses `actorPositionBefore`/`actorPositionAfter` - may not show intermediate waypoints
3. **LOF arcs** rendered as straight lines (not curved) for simplicity
4. **Speed control** only affects play/pause, not manual turn stepping

---

## Next Steps After Testing

1. Fix any critical bugs found
2. Document any workarounds for known limitations
3. Consider optional enhancements:
   - Filter/sort battles (Tab 1)
   - Export summary as PDF
   - Battle comparison view
   - AI analytics tab (Tab 5)
