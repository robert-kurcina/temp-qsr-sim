---
title: "Rules: Indirect Range Combat"
dependencies:
  - "Rules: Terrain"
  - "Rules: Tests and Checks"
  - "Rules: Combat"
status: "In-Progress"
---

## Indirect Range Combat (△)

Indirect Range Attacks are Range Attack actions against a target that is a **battlefield location** which is within LOF. This may or may not be within LOS. The weapon is usually a Grenade (has the Grenade trait), or an Item with the **AoE** keyword.

### Overview

Unless using a Natural weapon, the Active character acquires a **Delay token** if this is not its first attack this Initiative.

**Announce a Ranged weapon** to be used; the weapon must have an **OR value**. It must be:
- A **Thrown** weapon, OR
- Have the **Throwable** trait, OR
- Have the **[Arc]** trait

**Thrown weapons** have an OR written as `STR` or `STR + X"` to indicate that is equal to the Attacker's STR.

- If OR is zero it becomes **0.5 MU**
- If negative, disallow the Attack
- If the weapon has the **[Reveal]** trait, remove Attacker's **Hidden** status if in LOS. This is all Firearms weapons.

**Announce a battlefield location within LOF** to become the target of the Range Combat Attack.
- Place a small reminder pawn or token at the desired target location for ease of reference. Remove this after resolving the attack.
- There must exist a **midpoint** above the battlefield between the target location and Attacker which is no higher than the distance between the Attacker and the target, with **LOS to both**.

---

## Resolving Indirect Range Hit Test

The goal is to determine if the intended target location is where the weapon lands, or if it will become repositioned by **Scatter**.

### Hit Test Procedure

1. **Resolve the Indirect Attack Hit Test** as an **Unopposed RCA Test** **−1 Base die per OR Multiple [ORM]**. If fail, note any misses.

2. **Apply any Situational Test Modifiers** as necessary such as:
   - **Hindrance** (−1m per Wound/Delay/Fear token)
   - **Distance** (−1m per ORM)
   - **Point-blank** (+1m if within half OR)
   - **Direct Cover** (−1b)
   - **Intervening Cover** (−1m)

3. **Add weapon's Accuracy bonus**. This appears as "Acc" on the weapon's stat line on the Weapons list.

### Success/Failure

- **Pass**: Weapon lands at targeted location. **Cascades** = score (minimum 1 on any pass).
- **Fail**: Weapon **Scatters** (repositions from target location). **No cascades** on failure.

**Note:** For Unopposed tests, the score is compared against a target number of 0. Any positive score is a pass with cascades equal to the score (minimum 1).

---

## Scatter

Scatter causes the target location for an Indirect Range Attack (via the reminder pawn or token) to reposition a **distance** and a **direction**. The direction is determined by using a **Scatter diagram**.

### Reposition Rules

**Distance**: `misses × 1"`, but **at least 1 MU**

**Direction**: Determine the Scatter direction using a **Biased Scatter diagram**, along the **LOF from the Attacker to the target location**.

### Collision Rules

1. **Wall Collision**: If the target location was into a **Wall**, it repositions the remainder distance on the **reflected angle** of the incident angle.

2. **Barrier Stop**: If the attack again repositions into a barrier such as a **Wall**, **Obstacle**, **Building** or **Vehicle**, it **stops** at the point of contact.

### Roll-down (Gravity)

Indirect Range Attacks with at least one miss will reposition **additional distance** according to gravity, displacing the location of the attack **down slopes** and off **precipices**.

**Cliff/Precipice**: The distance repositioned off a cliff or precipice is:
- **0.5 MU per 1 MU dropped**, PLUS
- **1 MU per miss**

**Slopes**: Check slopes. Note the **rise over run** as the slope, such as **1 MU rise per 2 MU run is 0.5**. This is the default.
- Whenever repositioned atop yet another slope, **increase** the MU to be repositioned.
- **Repeat** for each slope encountered.
- **Stop** the reposition if it hits a **Wall** or **Obstacle**.

---

## Scrambling (△)

**Scrambling** is a form of **React action** for when a target location is attacked. It is allowed whenever performing an **Indirect Range Attack**, or if the **[Scatter]** trait is involved.

> See more information within the **Advanced Game Rules** section under **Passive Player options**.

---

## Apply Weapon Traits

Apply the weapon traits, starting with those with the **AoE** keyword.

### Area of Effect (AoE) Resolution

1. **If the weapon DOES NOT have the Frag trait**:
   - Have **any targets in base-contact** with the target location perform an **Unopposed Damage Test** against the weapon's **Dmg** ratings.

2. **If the weapon HAS the Frag trait**:
   - Apply the weapon's **Dmg** rating according to the **Frag trait** rules.
   - Only apply against those targets that **failed its Hit Test**.

---

## Scatter Diagrams

Scatter diagrams are used to pick a random direction for moving or placing game-play elements.

### Unbiased Diagram

- Picks a random direction equally.
- Use a vague hexagon shape.
- Roll a six-sided die and count **clock-wise** with the **‘1’ point toward the other player** and the **‘4’ pointing away**.

### Biased Diagram

- Like the Unbiased diagram, but the **‘1’ points to a desired direction** chosen by the Active player.
- **Re-roll the first ‘3’, ‘4’, or ‘5’**, then **re-roll the next ‘4’**.

---

## Blind Attacks

Indirect Range Attacks can target battlefield locations that an attacking model does **not** currently have LOS to.

**A target location in LOF but not LOS** may be attacked **only** if one of the following applies:
- **Spotter**: A Free Attentive Ordered Friendly model within Cohesion has LOS to the target.
- **Known**: The target was in LOS at the start of the Attacker’s Initiative.

**Blind effects:**
- **Blind**: Penalize the Active character **−1 Wild die** for the Attacker Range Combat Hit Test.
- If the attack involves **[Scatter]** and is **Blind**, use the **Unbiased Scatter diagram** with an **extra Wild die for distance**, and **do not re-roll the direction**.

---

## Implementation Notes

### Required Components

| Component | Status | Description |
|-----------|--------|-------------|
| **Indirect Hit Test** | ✅ Partial | Unopposed RCA test with −1b per ORM |
| **Scatter System** | ✅ Partial | Distance/direction reposition (bias configurable) |
| **Scatter Diagram** | ✅ Partial | Biased/unbiased direction supported |
| **Collision Detection** | ✅ Partial | Wall/barrier collision handling |
| **Roll-down/Gravity** | ❌ Missing | Slope and precipice handling |
| **Scrambling React** | ✅ Partial | React allowed; full react-system wiring TBD |
| **AoE Resolution** | ✅ Implemented | Base-contact target resolution |
| **Frag Trait** | ✅ Implemented | Fragmentation damage rules |
| **Blind Attacks** | ✅ Partial | Spotter/Known gating, blind hit-test penalty, and blind [Scatter] unbiased distance handling wired; arc/height fidelity remains pending |

### QSR Rule References

- **Indirect Range Attack**: Battlefield location target within LOF
- **Weapon Requirements**: Thrown, Throwable, or [Arc] trait
- **Midpoint Rule**: LOS arc requirement
- **Hit Test**: Unopposed RCA with −1b per ORM
- **Scatter**: misses × 1" (minimum 1 MU)
- **Roll-down**: 0.5 MU per 1 MU dropped + 1 MU per miss

---

## Related Rules

- [[rules-combat|Rules: Combat]] - Direct range combat resolution
- [[rules-terrain|Rules: Terrain]] - Terrain types and collision
- [[rules-tests-and-checks|Rules: Tests and Checks]] - Test resolution
- [[rules-advanced|Rules: Advanced]] - Scrambling and React actions
- [[rules-traits-list|Rules: Traits List]] - AoE, Frag, Scatter, [Arc] traits
