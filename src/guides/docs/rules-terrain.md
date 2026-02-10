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

| Terrain Type | Dimensions | Shape | Color | Type | LOS
| :--- | :--- | :--- |
| Shrub | 1 MU Diameter | Circle | Difficult | Soft
| Tree | 2 MU Diameter | Circle | Difficult | Soft
| Small Rocks | 1 x  MU | Ellipse | Rough | Hard
| Medium Rocks | 2 x 4 MU | Ellipse | Rough | Hard
| Large Rocks | 3 x 6 MU | Ellipse | Rough | Hard
| Short Wall | 0.5 x 6 MU | Rectangle | Impassable | Blocking
| Medium Wall | 1 x 8 MU | Rectangle | Impassable | Blocking
| Large Wall | 2 x 12 MU | Rectangle | Impassable | Blocking
| Small Building | 4 x 6 MU | Rectangle | Impassable | Blocking
| Medium Building | 6 x 8 MU | Rectangle | Impassable | Blocking
| Large Building | 8 x 10 MU | Rectangle | Impassable | Blocking
