---
title: Item Tech Windows
description: Technology window system for item availability by tech level.
priority: 9
---

# Item Tech Windows

This module defines the technology window system that determines when items become available and when they become obsolete.

**See also:** [[rules-technology-genres|Technology Levels & Genres]] for tech level definitions and period mappings.

---

## Tech Window System

Each item in MEST Tactics has a **Tech Window** that defines the range of tech levels where the item is available for use.

### Tech Window Structure

```json
{
  "item": "Item Name",
  "tech_window": {
    "early": <number>,
    "latest": <number>
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| **early** | number | Earliest tech level where item becomes available |
| **latest** | number | Latest tech level where item remains available |

### Availability Rules

An item is **available** at a given tech level if:
- `tech_level >= item.tech_window.early` AND
- `tech_level <= item.tech_window.latest`

**Example:**
- **Vibrodagger**: `{ early: 16, latest: 20 }`
  - Available at: Tech 16-20 (Quantum to Symbolic)
  - NOT available at: Tech 1-15 (Stone to Fusion)

- **Axe**: `{ early: 1, latest: 20 }`
  - Available at: All tech levels (Stone to Symbolic)

- **Powered Armor-Battle**: `{ early: 17, latest: 20 }`
  - Available at: Tech 17-20 (Energy to Symbolic)
  - NOT available at: Tech 1-16 (Stone to Quantum)

---

## Tech Window Categories

### Universal Items (Tech 1-20)

Items available throughout all technology periods:

| Item Type | Examples |
|-----------|----------|
| **Basic Weapons** | Axe, Club, Dagger, Spear, Bow |
| **Basic Armor** | Light Armor, Medium Armor, Heavy Armor |
| **Basic Equipment** | Torches, Medicinals, Hooks |
| **Natural Weapons** | Bite, Claws, Pummel |

### Period-Specific Items

#### Ancient Period (Tech 1-3)

| Tech Level | New Items |
|------------|-----------|
| **1 (Stone)** | Hide Armor, Clubs, Spears, Bows, Slings |
| **2 (Bronze)** | Battle Axes, War Boomerangs, Chakrams, Leadership Notebooks |
| **3 (Iron)** | Mail Armor, Crossbows, Ballista, Armored Gear |

#### Archaic Period (Tech 5-7)

| Tech Level | New Items |
|------------|-----------|
| **5 (Medieval)** | Great Swords, Scimitars, Heavy Crossbows, Archaic Rifles, Bombs |
| **6 (Renaissance)** | Rapiers, Powderkegs, Early Pistols |
| **7 (Colonial)** | Bayonets, Muskets, Arquebus, Petards |

#### Expansionist Period (Tech 8-10)

| Tech Level | New Items |
|------------|-----------|
| **8 (Sail)** | Cutlasses, Blunderbuss, Spyglasses, Goggles |
| **9 (Industrial)** | Sabers, Ammo Boxes, Detonators, Knuckledusters |
| **10 (Machine)** | Revolvers, Gatling Guns, Cannons, Springsuits, Electric Lanterns |

#### Modern Period (Tech 11-13)

| Tech Level | New Items |
|------------|-----------|
| **11 (Modern)** | Assault Rifles, Machine Guns, Grenades, Gas Masks, Flamethrowers |
| **12 (Atomic)** | Bulletproof Armor, Hardsuits, Night Vision Goggles, Auto-cannons |
| **13 (Information)** | Rail-guns, Advanced Sniper Scopes, Comm-links |

#### Near Future (Tech 14-15)

| Tech Level | New Items |
|------------|-----------|
| **14 (Robotics)** | Coil-guns, Jet-packs, Nanotech, Sonic Weapons, Exxo-skin |
| **15 (Fusion)** | Beam Rifles, Plasma Weapons, Powered Armor, Stealth Suits |

#### Far Future (Tech 16-18)

| Tech Level | New Items |
|------------|-----------|
| **16 (Quantum)** | Vibroblades, Advanced Beam Weapons, Powered Armor-Combat |
| **17 (Energy)** | Blasters, Arc Weapons, Powered Armor-Battle, Blast weapons |
| **18 (Gravity)** | Anti-gravity Harness, Displacer Devices |

#### Fantastic Period (Tech 19-20)

| Tech Level | New Items |
|------------|-----------|
| **19 (Symbolic)** | Arcanum items, Magic tomes, Anti-magic grenades |
| **20 (High Magic)** | Rings of Flight, Teleporters, Spectral weapons, Spell items |

### Obsolete Items

Some items become **obsolete** at higher tech levels:

| Item | Tech Window | Obsolete At | Reason |
|------|-------------|-------------|--------|
| **Armor, Combat Suit** | 1-11 | Tech 12+ | Replaced by Bulletproof Armor |
| **Springsuit** | 10-12 | Tech 13+ | Replaced by advanced suits |
| **Archaic Rifle** | 5-9 | Tech 10+ | Replaced by modern firearms |
| **Gatling Gun, Archaic** | 10-11 | Tech 12+ | Replaced by modern variants |

---

## ANY Tech Level Items

Some items have **null** tech windows, meaning they are available at **all tech levels** regardless of setting:

### Upgrades & Packages

| Item | Tech Window | Description |
|------|-------------|-------------|
| **Upgrade:Balanced** | ANY | Stat redistribution upgrade |
| **Upgrade:Masterworks** | ANY | Quality improvement |
| **Upgrade:Poisoned** | ANY | Adds poison effect |
| **Upgrade:Reinforced** | ANY | Durability improvement |
| **Package:Assassin** | ANY | Specialized training package |
| **Package:Berserker** | ANY | Combat frenzy package |
| **Package:Warrior** | ANY | General combat package |

### Special Items

| Item | Tech Window | Description |
|------|-------------|-------------|
| **Heirloom Weapon** | ANY | Family weapon with special significance |
| **Favored Passage** | ANY | Special movement ability |
| **Immune-Blast** | ANY | Blast immunity upgrade |

---

## Filtering Items by Tech Level

### For Profile Generation

When creating profiles for a specific battle, items are filtered based on the battle's tech level:

```typescript
// Medieval battle (Tech 5)
buildProfile('Average', {
  technologicalAge: 'Medieval',  // Tech 5
  itemNames: ['Axe', 'Vibrodagger', 'Sword, Long']
});
// Result: Vibrodagger filtered out (requires Tech 16)
// Available: Axe, Sword, Long
```

### For Assembly Building

When building assemblies, all items must be within the allowed tech window:

```typescript
// QSR Extended (Tech 1-5)
buildAssembly('Medieval Company', profiles, {
  techLevelConfig: {
    maxTechLevel: 5,
    minTechLevel: 1,
    allowAnyTech: true  // Allow upgrades/packages
  }
});
```

### Validation

The system validates items during profile creation:

```
Tech Level 5 (Medieval): Filtered out 2 items not available: Vibrodagger, Powered Armor-Battle
```

---

## Tech Window Data Source

Tech window data is stored in `src/data/item_tech_window.json` and aggregated into `src/lib/data.ts` during prebuild.

**Data format:**
```json
[
  {
    "item": "Vibrodagger",
    "tech_window": {
      "early": 16,
      "latest": 20
    }
  },
  {
    "item": "Axe",
    "tech_window": {
      "early": 1,
      "latest": 20
    }
  }
]
```

---

## Related Files

- [[rules-technology-genres|Technology Levels & Genres]] - Tech level definitions and period mappings
- [[rules-archetypes-and-profiles|Archetypes and Profiles]] - Profile generation with tech filtering
- [[rules-assemblies-and-setup|Assemblies & Setup]] - Assembly building with tech restrictions
- `src/data/item_tech_window.json` - Raw tech window data
- `src/lib/mest-tactics/utils/tech-level-filter.ts` - Filtering implementation

---

**Source:** `src/data/tech_level.json`, `src/data/item_tech_window.json`, `src/guides/docs/rules-technology-genres.md`
