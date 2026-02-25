---
title: "Rules: Terrain"
dependencies:
  - "Rules: Core Mechanics" # DONE
  - "Rules: Character Attributes" # DONE
status: "In-Progress"
---

## Terrain and Spatial Representation

Terrain and character models are represented in a 2D spatial environment, each with a specific position and footprint.

### Character Footprint

A character, or "model", exists at a specific `(x, y)` coordinate on the battlefield. Their physical space is defined by a circular base.

*   **Base Diameter:** The diameter of a model's base is directly related to its **SIZ** (Size) attribute. A typical SIZ 3 character has a base diameter of 1 Measurement Unit (MU).
*   **Melee Range:** A model's melee range begins at base-to-base contact. However, to account for the imprecision of combat, an active model is considered to have a melee reach that extends **0.5 MU** beyond the radius of its base.

### Terrain Footprint

Terrain elements are defined by a 2D mesh, representing their shape and the space they occupy on the battlefield. The footprint for each piece of terrain is data-driven, defined by a list of coordinates that form its shape.

## Terrain Classification

All terrain is classified by its effect on movement. The primary classifications are:

*   **Clear:** No movement penalty.
*   **Rough:** Costs 2" of movement for every 1" crossed. Models entering must stop unless they acquire a Delay token.
*   **Difficult:** Costs 2" of movement for every 1" crossed. Models entering must stop.
*   **Impassable:** Cannot be moved through.

## Key Terrain Types

The following are standard terrain elements. For the initial implementation, all of these are considered **Impassable**.

| Terrain Type | Dimensions | Shape | Color | Type | LOS | Distribution | Category
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Shrub | 1 MU Diameter | Circle | #006400 | Difficult | Soft | 3 | Shrub |
| Tree | 2 MU Diameter | Circle | #90EE90 | Difficult | Soft | 3 | Tree |
| Small Rocks | 1 x  MU | Ellipse | #D3D3D3 | Rough | Hard | 3 | Rocks |
| Medium Rocks | 2 x 4 MU | Ellipse | #D3D3D3 | Rough | Hard | 2 | Rocks |
| Large Rocks | 3 x 6 MU | Ellipse | #D3D3D3 | Rough | Hard | 1 | Rocks |
| Short Wall | 0.5 x 6 MU | Rectangle | #555555 | Impassable | Blocking | 3 | Wall |
| Medium Wall | 1 x 8 MU | Rectangle | #555555 | Impassable | Blocking | 2 | Wall |
| Large Wall | 2 x 12 MU | Rectangle | #555555 | Impassable | Blocking | 1 | Wall |
| Small Building | 4 x 6 MU | Rectangle | #000000 | Impassable | Blocking | 3 | Building |
| Medium Building | 6 x 8 MU | Rectangle | #000000 | Impassable | Blocking | 2 | Building |
| Large Building | 8 x 10 MU | Rectangle | #000000 | Impassable | Blocking | 1 | Building |
| Small Rough Patch | 6 x 9 MU | Rectangle | #C49A6C | Rough | Clear | 3 | Area |
| Medium Rough Patch | 9 x 12 MU | Rectangle | #C49A6C | Rough | Clear | 2 | Area |
| Large Rough Patch | 12 x 15 MU | Rectangle | #C49A6C | Rough | Clear | 1 | Area |

## Procedural Placement Rules

Terrain placement can be procedurally generated using weighted categories and a density ratio.

### Categories and Weights

Supported terrain categories:
- `area`
- `shrub`
- `tree`
- `rocks`
- `wall`
- `building`

Each category is assigned a weight (0–100). The density ratio (10–100, default 25) indicates how much of the battlefield area should be covered by terrain elements.
BlockLOS (0–100, default 25) indicates how much of the battlefield should be blocked for clear LOS segments (1 MU wide, 8 MU long). A value of 0 means the battlefield remains entirely clear; 100 means no clear LOS segments remain.

### Count Formula

For each terrain element, compute the count as:

```
count = floor((battlefieldArea * densityRatio/100) * (weight/100) / (3 * distribution * elementArea))
```

Where:
- `distribution` is 1–3 and is defined per terrain element.
- `elementArea` is the MU area of the element’s footprint.

### Placement Order and Spacing

Placement order and minimum spacing:
- Area terrain first. Minimum spacing: 3 MU from other Area terrain. This is a separate layer.
- Buildings next. Minimum spacing: 3 MU from other elements.
- Walls next. Minimum spacing: 1 MU from buildings or other walls; otherwise 3 MU.
- Trees next. Minimum spacing: 1 MU from buildings or walls; otherwise 3 MU.
- Rocks next. Minimum spacing: 3 MU.
- Shrubs last. Minimum spacing: 3 MU.

Area terrain is placed on its own layer. Other terrain types may be placed atop area terrain.

BlockLOS is evaluated after each non-area blocking placement. If the blocked fraction exceeds the configured BlockLOS target, the placement is rejected.

### Rotation

Terrain elements can be rotated from 0–360 degrees in 15-degree increments. Walls should align with the closest building or be perpendicular, or align to an existing wall when possible.
