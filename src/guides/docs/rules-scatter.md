---
title: "Rules: Scatter Diagram"
dependencies:
  - "Rules: Indirect Range Combat"
  - "Rules: Tests and Checks"
status: "Complete"
---

## Scatter Diagram

When an **Indirect Range Attack** misses, the target location **Scatters** from its intended position. The Scatter is determined using a **hexagonal template** with six directional arrows.

### Scatter Diagram Template

The Scatter diagram consists of **six arrows** arranged in a **hexagonal pattern**:

```
        ↑
    ↖       ↗
        ●
    ↙       ↘
        ↓
```

**Direction Arrows:**
- **Forward** (↑) — Along Line of Fire toward target
- **Forward-Right** (↗) — 60° clockwise from Forward
- **Backward-Right** (↘) — 120° clockwise from Forward
- **Backward** (↓) — 180° from Forward (away from attacker)
- **Backward-Left** (↙) — 240° clockwise from Forward
- **Forward-Left** (↖) — 300° clockwise from Forward

**Center Point (●):** The original target location

### Determining Scatter Direction

1. **Place the Scatter Diagram** over the battlefield with the **Forward arrow pointing along the Line of Fire** from Attacker to target location.

2. **Roll 1d6** to determine scatter direction:

| d6 Roll | Direction | Angle from LOF |
|---------|-----------|----------------|
| 1 | Forward | 0° |
| 2 | Forward-Right | 60° |
| 3 | Backward-Right | 120° |
| 4 | Backward | 180° |
| 5 | Backward-Left | 240° |
| 6 | Forward-Left | 300° |

3. **Measure Scatter Distance**: `misses × 1"` (minimum 1 MU)

4. **Reposition the target location** in the rolled direction by the scatter distance.

### Scatter Distance

**Scatter Distance = misses × 1"** (minimum 1 MU)

- If the Hit Test fails by **1**, scatter **1"**
- If the Hit Test fails by **3**, scatter **3"**
- Minimum scatter is always **1 MU** even with 0 misses

### Scatter Resolution Sequence

1. **Determine Scatter Direction** (1d6 roll)
2. **Calculate Scatter Distance** (misses × 1")
3. **Reposition target location** in scatter direction
4. **Check for collisions** (Walls, Obstacles, Buildings)
5. **Apply Roll-down** if on slope/precipice
6. **Resolve Area Effect** at final location

### Collision Rules

#### Wall Collision
If the scattered location would be **inside a Wall**:
- The scatter **reflects** off the wall
- **Angle of Incidence = Angle of Reflection**
- Continue remaining scatter distance in reflected direction

#### Barrier Stop
If the scattered location would be inside:
- **Obstacle**
- **Building**
- **Vehicle**

The scatter **stops** at the point of contact. Remaining scatter distance is **lost**.

### Roll-down (Gravity)

When a scatter lands on a **slope** or **precipice**, gravity causes additional displacement:

**Precipice/Cliff Roll-down:**
```
Roll-down Distance = (0.5 MU per 1 MU dropped) + (1 MU per miss)
```

**Slope Roll-down:**
- Calculate slope as **rise over run** (e.g., 1 MU rise per 2 MU run = 0.5 slope)
- When scattering onto a slope, **increase** scatter distance by the slope factor
- **Repeat** for each slope encountered
- **Stop** if hits Wall or Obstacle

### Example Scatter Resolution

**Scenario:**
- Attacker fires grenade at target location 10" away
- Hit Test fails by **2 misses**
- Scatter roll: **4** (Backward)

**Resolution:**
1. Scatter direction: **Backward** (180° from LOF, toward attacker)
2. Scatter distance: **2 misses × 1" = 2"**
3. Reposition target **2" toward attacker** along LOF
4. Check for collisions (none)
5. Check for roll-down (flat terrain, none)
6. Resolve Area Effect at new location

### Scrambling React (△)

When an Indirect Range Attack is declared, targets at the location may use **Scrambling** as a React action:

- **Cost:** 1 AP (or free if Waiting)
- **Effect:** Move up to MOV × 0.5" away from target location
- **Timing:** Before scatter is determined

> See **Advanced Game Rules** section for full Scrambling rules.

---

## Implementation Notes

### Scatter Diagram Usage

The hexagonal scatter diagram provides **six discrete directions** rather than continuous 360° scatter. This simplifies gameplay while maintaining tactical unpredictability.

**Key Design Decisions:**
- **6 directions** (not 8) — Matches hexagonal grid gameplay
- **60° increments** — Natural hexagon angles
- **d6 roll** — Single die, fast resolution
- **Bias** — Depending on mission or optional rules, scatter may be **Unbiased** (equal probability) or **Biased** (forward-weighted). Use the agreed bias setting before play.

### Collision Detection

**Line Tracing:** Check the line from original target to scattered position for terrain intersections.

**Reflection Calculation:**
```
Reflected Direction = Incoming Direction - 2(Incoming Direction · Wall Normal) × Wall Normal
```

### Roll-down Priority

1. **Check precipice first** (discontinuous height change)
2. **Then check slopes** (continuous gradient)
3. **Stop at barriers** (Walls, Obstacles)

---

## Related Rules

- [[rules-indirect|Rules: Indirect Range Combat]] — Indirect attack resolution
- [[rules-terrain|Rules: Terrain]] — Terrain types and collision
- [[rules-advanced|Rules: Advanced]] — Scrambling React action
- [[rules-tests-and-checks|Rules: Tests and Checks]] — Hit Test resolution
