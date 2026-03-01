---
title: "Rules: Character Portraits"
dependencies:
status: "Complete"
lastUpdated: "2026-02-28"
---

## 2D Character Models

A character is represented in the 2D environment with an image and this is its model for use during gameplay.

| Species | Ancestry | Lineage | Sex | SIZ | File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Gnoash | Hjoyan | Oaghiri | Both | 4 | portraits/gnoash-hjoyan-oaghiri.jpg |
| Humaniki | Alef | Akrunai-Auldaran | Male | 3 | portraits/alef-akrunai-auldfaran-male.jpg |
| Humaniki | Alef | Akrunai-Borondan | Male | 3 | portraits/alef-akruniai-borondan-male.jpg |
| Humaniki | Babbita | Indelan | Male | 3 | portraits/babbita-indelan-male.jpg |
| Humaniki | Human | Eniyaski | Male | 3 | portraits/human-eniyaski-male.jpg |
| Humaniki | Human | Quaggkhir | Female | 3 | portraits/human-quaggkhir-female.jpg |
| Humaniki | Human | Quaggkhir | Male | 3 | portraits/human-quaggkhir-male.jpg |
| Humaniki | Human | Vasikhan | Male | 3 | portraits/human-vasikhan-male.jpg |
| Orogulun | Orok | Orogu | Male | 3 | portraits/orugu-common-male.jpg |
| Jhastruj | Jhastra | Jhasu | Male | 2 | portraits/lizardfolk-common-male.jpg |
| Gorblun | Golbrini | Globlin | Male | 2 | portraits/golbrini-common-male.jpg |
| Klobalun | Korkbul | Kolboh | Male | 1 | portraits/kobolds-common-male.jpg |

**SIZ-Based Model Diameter:**
| SIZ | Base Diameter | MU | Species Examples |
|-----|---------------|-----|------------------|
| 4 | 40mm | 1.33 MU | Oaghiri |
| 3 | 30mm | 1.00 MU | Humaniki, Alef, Orogulun |
| 2 | 20mm | 0.67 MU | Jhasu (Lizardfolk), Gorblun |
| 1 | 10mm | 0.33 MU | Klobalun (Kobolds) |

**Implementation:** See `src/lib/portraits/portrait-sheet-registry.ts` for the complete mapping.

## Portrait Sheet Layout

Portrait sheets are arranged as 8 columns by 6 rows on a 1920 x 1920 canvas. Each cell is a portrait that can be clipped using a circular mask. The clip anchor is defined by the `clip-example` circle in `portraits/human-quaggkhir-male-example-clip.svg`. Column/row indexing is 0-based (top-left is 0:0).
The default portrait sheet is `portraits/human-quaggkhir-male.jpg` unless otherwise specified.

Clip math (column `c`, row `r`):

```
cellWidth = sheetWidth / 8
cellHeight = sheetHeight / 6
centerX = baseCx + c * cellWidth
centerY = baseCy + r * cellHeight
radius = baseR
```

The anchor values are stored in `src/lib/portraits/portrait-clip.ts`, which exports `getClipMetrics(...)`.

**Implementation:**
- `src/lib/portraits/portrait-clip.ts` — Clip metrics calculation
- `src/lib/mest-tactics/battlefield/rendering/PortraitRenderer.ts` — SVG rendering

## Demo Generator

Use `npm run generate:portraits` to regenerate `portraits/index.html`. The demo loads the first portrait sheet it finds and lets you change column/row to verify clipping.

**Usage:**
```bash
npm run generate:portraits
open assets/portraits/index.html
```

## Character Call Signs (Portrait Mapping)

Characters receive a unique name in the format `AA-00` through `ZZ-75`. The first digit maps to the portrait column, and the second digit maps to the portrait row. Example: `BA-32` uses column 3 and row 2. These indices are 0-based.

**Call Sign Format:**
```
[Letter][Letter]-[Digit][Digit]
  AA        -   00
  ││            ││
  ││            │└─ Row (0-5)
  ││            └── Column (0-7)
  │└────────────── Second letter (A-Z)
  └─────────────── First letter (A-Z)
```

**Examples:**
| Call Sign | Column | Row | Sheet Position |
|-----------|--------|-----|----------------|
| AA-00 | 0 | 0 | Top-left |
| BA-32 | 3 | 2 | Middle |
| CZ-75 | 7 | 5 | Bottom-right |

**Implementation:**
- `src/lib/portraits/portrait-naming.ts` — Call sign parsing/generation
- `src/lib/mest-tactics/mission/MissionSide.ts` — Auto-assignment during character creation

## Dashboard Integration

Character portraits are displayed in the Visual Audit dashboard (Tab 2):

- **Model Roster** — Grid of circular portrait clips above timeline controls
- **Clickable** — Click portrait to select model
- **Call Sign Display** — Each portrait shows its call sign overlay

**Access:** `http://localhost:3001/dashboard` → Tab 2: Visual Audit

**Implementation:**
- `src/lib/mest-tactics/viewer/audit-dashboard.html` — Model roster UI
- `scripts/serve-terrain-audit.ts` — Asset serving (`/assets/portraits/*`)

## API Reference

### Portrait Sheet Registry

```typescript
import { 
  getPortraitSheetForProfile,
  getBaseDiameterForProfile,
  getAvailablePortraitSheets,
  PORTRAIT_SHEET_REGISTRY 
} from './src/lib/portraits/portrait-sheet-registry';

// Get sheet for character profile
const sheet = getPortraitSheetForProfile({
  species: 'Humaniki',
  ancestry: 'Human',
  lineage: 'Quaggkhir',
  sex: 'Male',
  siz: 3
});
// Returns: 'assets/portraits/human-quaggkhir-male.jpg'

// Get base diameter for SIZ-based scaling
const diameter = getBaseDiameterForProfile({ siz: 2 });
// Returns: 0.67 (MU)

// List all available sheets
const sheets = getAvailablePortraitSheets();
```

### Portrait Naming

```typescript
import { 
  createPortraitName,
  parsePortraitName,
  createPortraitAssignmentFromIndex,
  createPortraitAssignmentFromName 
} from './src/lib/portraits/portrait-naming';

// Generate call sign from index (0-62399)
const name = createPortraitName(0);      // "AA-00"
const name2 = createPortraitName(100);   // "AB-04"

// Parse call sign to column/row
const { column, row } = parsePortraitName("BA-32");
// column: 3, row: 2

// Create full assignment
const assignment = createPortraitAssignmentFromIndex(50);
// { name: "AB-22", sheet: "...", column: 2, row: 2 }
```

### Portrait Rendering

```typescript
import { 
  renderPortraitSvg,
  getPortraitClipData,
  parseCallSign 
} from './src/lib/mest-tactics/battlefield/rendering/PortraitRenderer';

// Get clip data for call sign
const clipData = getPortraitClipData("AA-00", {
  sheetPath: 'assets/portraits/human-quaggkhir-male.jpg',
  sheetWidth: 1920,
  sheetHeight: 1920,
  baseDiameterMu: 1.0
});

// Render SVG element
const svg = renderPortraitSvg(clipData, { x: 10, y: 10 }, 1.0, 1.0);
```

## Testing & Verification

### 1. Run Demo Generator
```bash
npm run generate:portraits
open assets/portraits/index.html
```
- Verify clipping works for all 48 positions (8×6)
- Test column/row selectors

### 2. Test Call Sign Assignment
```bash
npm run ai-battle -- VERY_SMALL 25
```
- Check that characters have call signs (AA-00 format)
- Verify call signs are unique per model

### 3. Test Dashboard Display
```bash
npm run serve:reports
# Open http://localhost:3001/dashboard
# Go to Tab 2: Visual Audit
# Select a battle
```
- Verify portraits display in model roster
- Check call sign overlays
- Test portrait clicking

### 4. Test SIZ Scaling
```bash
# Create battle with mixed SIZ characters
# Check that SIZ 1 (kobolds) appear smaller than SIZ 3 (humans)
```

## Troubleshooting

### Portraits Not Showing
1. Check asset path: `assets/portraits/*.jpg` must exist
2. Verify server serves `/assets/` directory
3. Check browser console for 404 errors

### Wrong Portrait Sheet
1. Verify character profile matches registry exactly (case-insensitive)
2. Check fallback to default sheet (`human-quaggkhir-male.jpg`)
3. Ensure `getPortraitSheetForProfile()` is called with correct profile

### Call Sign Collision
1. Check `startingIndex` in MissionSide options
2. Ensure unique index per character across all sides
3. Maximum 62,400 unique call signs (26×26×8×6)

### Clipping Issues
1. Verify sheet dimensions are 1920×1920
2. Check clip metrics in `portrait-clip.ts`
3. Test with demo generator first

## Adding New Portrait Sheets

### 1. Add Image File
Place new sheet in `assets/portraits/`:
```
assets/portraits/elf-sylvanian-female.jpg
```

### 2. Update Registry
Edit `src/lib/portraits/portrait-sheet-registry.ts`:
```typescript
{
  species: 'Elf',
  ancestry: 'Sylvanian',
  lineage: 'Female',
  sex: 'Female',
  siz: 3,
  sheetPath: 'assets/portraits/elf-sylvanian-female.jpg',
  baseDiameterMu: 1.0,
}
```

### 3. Regenerate Demo
```bash
npm run generate:portraits
```

### 4. Test
```bash
# Create character with new profile
# Verify correct sheet is selected
# Check dashboard display
```

## Performance Considerations

- **Sheet Loading:** Sheets are loaded on-demand via CSS `background-image`
- **Clip Calculation:** Pre-computed in `portrait-clip.ts` (no runtime math)
- **SVG Rendering:** Cached in battle report generation
- **Memory:** ~2MB per sheet (JPEG compressed)

## Future Enhancements

- [ ] Custom sheet selection per assembly
- [ ] Animated portrait transitions
- [ ] Damage state overlays (wounded, KO)
- [ ] 3D model support
- [ ] Custom portrait upload
