---
title: Armor Materials
description: Material hardness, armor ratings, and historical/technological progression for armor crafting.
priority: 8
---

# Armor Materials

This module provides the material hardness chart for adjusting armor values based on the technological level of the game setting.

## Material Hardness Chart

Use this chart to adjust **Armor Rating [AR]**, **Hardness Rating [HR]**, and **Fortitude [FOR]** values for armor based on the material used.

The **FOR values** shown are **2 higher than normal** to represent the best that the material could provide.

| AR | HR | FOR | Material | Year/Era |
|:--:|:--:|:--:|----------|----------|
| 7 | 4 | 17 | **Layered Fullerene Fibers** | 3000 (Future) |
| 6 | 3 | 16 | **Graphene Polymers** | 2250 (Future) |
| 5 | 3 | 15 | **Palladium Glass** | 2100 (Future) |
| 4 | 2 | 14 | **Diamond Shell** | 2050 (Future) |
| 3 | 2 | 13 | **Super Polymers** | 2025 (Modern+) |
| 2 | 1 | 12 | **Tungsten Alloys**, Bulky Polymers | 2000 (Modern) |
| 1 | 1 | 11 | **Depleted Uranium**, Advanced Ceramics | 1950 (Modern) |
| 0 | 0 | 10 | **Dense Steel**, Dense Ceramics | 1900 (Industrial) |
| -1 | 0 | 9 | **Soft Steel**, Titanium, Ceramics | 1300 (Renaissance) |
| -2 | 0 | 8 | **Iron**, Bronze, Early Steel | -2250 (Ancient/Medieval) |
| -3 | 0 | 7 | **Stone Walls**, Bone, Dry Hide, Rubber | -5000 (Prehistoric) |

## Using the Chart

### Armor Rating [AR] Adjustment

The **AR column** shows the modifier to apply to the base armor type:

| Base Armor | Base AR | Example: Iron (AR -2) | Example: Steel (AR 0) | Example: Graphene (AR +6) |
|------------|---------|----------------------|----------------------|--------------------------|
| **Armor, Light** | 2 | 0 | 2 | 8 |
| **Armor, Medium** | 4 | 2 | 4 | 10 |
| **Armor, Heavy** | 6 | 4 | 6 | 12 |
| **Shield, Light** | 1 | -1 → 0 | 1 | 7 |
| **Shield, Medium** | 1 | -1 → 0 | 1 | 7 |
| **Full Helm** | 1 | -1 → 0 | 1 | 7 |

**Note:** Minimum AR is **0** (cannot be negative).

### Hardness Rating [HR] → Hardened X

The **HR column** converts directly to the **Hardened X** trait:

| HR | Trait | Effect |
|----|-------|--------|
| 0 | — | No Hardened trait |
| 1 | **Hardened 1** | +1 vs. certain damage types |
| 2 | **Hardened 2** | +2 vs. certain damage types |
| 3 | **Hardened 3** | +3 vs. certain damage types |
| 4 | **Hardened 4** | +4 vs. certain damage types |

### Fortitude [FOR] Adjustment

The **FOR column** can be used to adjust the **effective FOR** of characters wearing armor made from that material for purposes of **Damage Tests**:

- **Base human FOR**: 2
- **Material bonus**: FOR value - 10
- **Effective FOR**: Base FOR + Material bonus

**Example:**
- Character in **Iron armor** (FOR 8): Effective FOR = 2 + (8 - 10) = **0**
- Character in **Steel armor** (FOR 10): Effective FOR = 2 + (10 - 10) = **2**
- Character in **Graphene armor** (FOR 16): Effective FOR = 2 + (16 - 10) = **+8**

## Era Classifications

### Prehistoric (Before -2250)
**Materials:** Stone, Bone, Dry Hide, Rubber
**AR Modifier:** -3
**Typical Armors:** Hide armor, bone plates, wooden shields

### Ancient/Medieval (-2250 to 1300)
**Materials:** Iron, Bronze, Early Steel
**AR Modifier:** -2
**Typical Armors:** Chainmail, scale armor, bronze breastplates, iron helmets

### Renaissance (1300 to 1900)
**Materials:** Soft Steel, Titanium, Ceramics
**AR Modifier:** -1
**Typical Armors:** Plate armor, steel breastplates, reinforced helmets

### Industrial (1900 to 1950)
**Materials:** Dense Steel, Dense Ceramics
**AR Modifier:** 0 (baseline)
**Typical Armors:** Steel plate armor, early ballistic vests

### Modern (1950 to 2025)
**Materials:** Depleted Uranium, Advanced Ceramics, Tungsten Alloys, Bulky Polymers
**AR Modifier:** +1 to +2
**Typical Armors:** Composite armor, reactive armor, Kevlar, ceramic plates

### Future (2025 to 3000+)
**Materials:** Super Polymers, Diamond Shell, Palladium Glass, Graphene Polymers, Layered Fullerene Fibers
**AR Modifier:** +3 to +7
**Typical Armors:** Energy shields, nanofiber suits, crystalline armor

## Genre Applications

### Bronze Age (~2250 BCE)
- Use **Ancient/Medieval** column (-2 AR)
- Typical: Bronze breastplate (AR 2), Leather armor (AR 0)

### Medieval (~500-1500 CE)
- Use **Ancient/Medieval** to **Renaissance** column (-2 to -1 AR)
- Typical: Chainmail (AR 2), Plate armor (AR 4-5)

### Renaissance (~1300-1700 CE)
- Use **Renaissance** column (-1 AR)
- Typical: Steel plate (AR 5), Brigandine (AR 3)

### Modern (~1900-2025 CE)
- Use **Industrial** to **Modern** column (0 to +2 AR)
- Typical: Flak jacket (AR 2), Ballistic vest (AR 3-4)

### Science Fiction (~2025-3000 CE)
- Use **Future** column (+3 to +7 AR)
- Typical: Powered armor (AR 8-10), Energy shields (AR 10+)

## Crafting Rules

### Material Substitution

When crafting armor, players may substitute materials based on availability:

1. **Determine base armor type** (Light, Medium, Heavy)
2. **Apply material AR modifier** from chart
3. **Adjust BP cost**: +1 BP per +1 AR, -1 BP per -1 AR (minimum 1 BP)
4. **Add traits** as appropriate (Hardened X, Laden, etc.)

### Example: Crafting Iron Plate Armor

**Base:** Armor, Medium (AR 4, 13 BP)
**Material:** Iron (AR -2)
**Result:**
- **Final AR:** 4 + (-2) = **2**
- **Final BP:** 13 + (-2) = **11 BP**
- **Traits:** [Laden 2], Deflect (unchanged)

### Example: Crafting Graphene Combat Suit

**Base:** Armor, Light (AR 2, 8 BP)
**Material:** Graphene Polymers (AR +6, HR 3)
**Result:**
- **Final AR:** 2 + 6 = **8**
- **Final BP:** 8 + 6 = **14 BP**
- **Traits:** Hardened 3, [Laden] (adjusted for material)

## Related Rules

- [[rules-items|Rules: Items]] — Armor types and equipment
- [[rules-traits-list|Rules: Traits List]] — Armor X, Hardened X traits
- [[rules-damage-and-morale|Rules: Damage & Morale]] — Armor Rating and damage reduction

---

## Quick Reference

| Era | AR Mod | Example Materials |
|-----|--------|-------------------|
| **Prehistoric** | -3 | Stone, Bone, Hide |
| **Ancient/Medieval** | -2 | Iron, Bronze, Early Steel |
| **Renaissance** | -1 | Soft Steel, Titanium |
| **Industrial** | 0 | Dense Steel, Ceramics |
| **Modern** | +1 to +2 | Uranium, Ceramics, Tungsten |
| **Future** | +3 to +7 | Graphene, Fullerene, Diamond |

**Formula:**
```
Final AR = Base Armor AR + Material AR Modifier
Final BP = Base BP + Material AR Modifier (minimum 1 BP)
Hardened X = Material HR value
```
