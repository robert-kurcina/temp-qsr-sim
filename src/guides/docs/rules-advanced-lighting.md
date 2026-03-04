---
title: Advanced Rules - Lighting
description: Complete rules for atmospheric lighting, point-light sources, and Light Casting in the Advanced Game.
priority: 6
---

# Advanced Rules - Lighting

**Rule Level:** Advanced ()

Lighting in the Advanced Game can be nuanced. Outside it could be "**Night**" but within a building it may be "**Twilight**" because of lamps and chandeliers. It could also be the opposite; outside it is "**Day**" but inside a window-less warehouse building it is "**Night**".

---

## Atmospheric Lighting

This is **environmental lighting** for the battlefield. This includes any ambient lighting within a building.

### Setting Lighting

When deciding on the Lighting for a Mission, players will still choose between:
- "**Day, Clear**"
- "**Twilight, Overcast**"

As before.

### Custom Lighting

Other lighting values are may also be chosen, such as:
- "**Night, Full Moon**" at OR 4
- "**Night, Half Moon**" at OR 2
- And others listed below

When deciding for custom scenarios on what lighting is available, be sure to use the table below to properly set the mood. This Lighting then sets the **Visibility OR**.

### Lighting Table

| OR | Time of Day | Atmosphere | Point-light | Light |
|----|-------------|------------|-------------|---------|
| 0 | Night | Pitch-black | - | - |
| 1 | Night | New Moon | Candle | 1 |
| 2 | Night | Half Moon | Flash-light | 2 |
| 4 | Night | Full Moon | Torch | 4 |
| 6 | Night | Super Moon | Lantern | 6 |
| 8 | Twilight | Overcast | Lamppost | 8 |
| 10 | Twilight | Clear | Headlights | 10 |
| 12 | Day | Overcast | Floodlights | 12 |
| 14 | Day | Hazy | - | - |
| 16 | Day | Clear | - | - |

**Notes:**
-  **Twilight** occurs at **Sunset** and at **Sunrise**, can be written as either if a Mission or Scenario is being specific
-  This is the **Light X level** of the Point-light source where X is also the **default Light OR** when within 1 MU of the source. It is the **Visibility OR** when applied as **Atmospheric Lighting**
-  These are **Light X (Flicker)**, such as **Light 4 (Flicker)** for Torch

---

## Internal Lighting

All **enclosed lit Buildings** when the "**lights are on**" will have at least **Atmospheric Light OR 4"**.

### Modern Buildings

- Use **OR 6"** if **Modern period**
- Use **Light OR 8"** if **Near Future**

### Light Switches

- Doors within modern Buildings will have **light switches** to toggle one or more **Point-light sources**
- These switches can be easily **destroyed** for a **Fiddle action** while in **base-contact**

### Windows

Windows facing outside become **Point-light sources** for internal areas:
- **Light X trait** equal to **half the Atmospheric Light X**
- **Tinted windows** are **Atmospheric Light X divided by 4**
- **Drop all fractions**

---

## Point-light Sources

Characters may be assigned Equipment which includes **Torches**, **Lanterns**, and **Lamps**. There may also be **Lampposts** or **Chandeliers** placed or identified upon the battlefield. Or **Fire**. All of these are **Point-light sources** with the **Light X trait**, with X as shown on the chart above.

### Properties

- Elements with the **Light X trait** are Light sources with a **Light OR equal to X MU**
- Players should identify and set the **Light X OR** for all non-obvious Point-light sources which may affect game-play

### Hidden Status

- A model in **base-contact** with or **equipped with a Light source** may **never be Hidden** unless **out of LOS**
- If LOS to a Light source is **behind Cover** and **beyond 1 MU**, **reduce the Light X by half**, but at least by 1

---

## Light Casting

The effective **Light OR** diminishes with the distance to a Point-light source. This is known as "**Light Casting**".

### Effective Light OR

Use the **Effective Lighting table** for the effective Light OR by the distance of the Point-light source to a target.

- A model **holding** or **in base-contact** with a Point-light source, or **within 1 MU of it** and **in front of the LOF** to a target, experiences **at least the effective Light OR**
- If **Atmospheric Lighting is higher**, use that
- The effective Light OR is **otherwise reduced**

### Angle Reduction

Set the **LOF from the Light source to the target**, and use the **Scatter Diagram** to determine the angle for the Active character. Each arrow is **60-degrees apart**.

| Angle from LOF | Reduction |
|----------------|-----------|
| Within 60-degrees | -1 |
| Within 120-degrees | -2 |
| Everything else | -3 |

### Examples

**Example 1:** A **Lamp Post** has **Light 8**. Presuming that Atmospheric Lighting is zero:
- A target at a distance of **2 MU** creates an effective **Light OR 6"**
- A target at a distance of **6 MU** creates an effective **Light OR 3"**
- A target at a distance of **24 MU** creates an effective **Light OR of zero** and can't be targeted

**Example 2:** If the Light Casting is effectively **Light OR 3"**:
- If the Active character is **within 60-degrees** of the LOF, this becomes effective **Light OR 2"**
- If instead the character is **within 120-degrees** of the LOF, this becomes effective **Light OR 1"**
- For everything else, this becomes effective **Light OR 0.5"**

---

## Effective Lighting Table

| Light X | 1 MU | 2 MU | 3 MU | 4 MU | 6 MU | 8 MU | 12 MU | 16 MU | 24 MU | 32 MU | 48 MU | 64 MU |
|---------|------|------|------|------|------|------|-------|-------|-------|-------|-------|-------|
| 1 | 0.5 | - | - | - | - | - | - | - | - | - | - | - |
| 2 | 1 | 0.5 | - | - | - | - | - | - | - | - | - | - |
| 3 | 2 | 1 | 0.5 | - | - | - | - | - | - | - | - | - |
| 4 | 3 | 2 | 1 | 0.5 | - | - | - | - | - | - | - | - |
| 6 | 5 | 4 | 3 | 2 | 1 | 0.5 | - | - | - | - | - | - |
| 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0.5 | - | - | - | - |
| 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0.5 | - | - |
| 12 | 11 | 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0.5 |

---

## Related Files

- [[rules-visibility|Rules: Visibility]] - Core visibility rules
- [[rules-advanced-fire|Advanced Rules - Fire]] - Fire as light source
- [[rules-advanced-effects|Advanced Rules - Expanded Effects]] - Blinded status

---

**Source:** `docs/canonical/MEST.Tactics.Advanced-Lighting.txt`
