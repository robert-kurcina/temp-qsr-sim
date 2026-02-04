
# MEST Tactics QSR Simulation Rules

This document outlines the rules and data structures used in the MEST Tactics QSR simulation application.

## Core Concepts

### Archetypes

An Archetype is the foundational template for a character. It defines the character's starting attributes, inherent traits, species, and base point value (BP). Archetypes are defined in `src/lib/data/archetypes.json`.

### Items

Items represent the gear a character can equip, including weapons, armor, and equipment. Each item has its own BP, traits, and other characteristics. All items are defined in the `src/lib/data/` directory, categorized by type (e.g., `melee_weapons.json`, `armors.json`).

### Profile

A Profile represents a specific configuration of an Archetype combined with a set of Items. It acts as a pre-built template for creating a game-ready Character. The key features of a Profile are:

- **Name**: A unique identifier for the profile.
- **Archetype**: The base archetype data.
- **Items**: An array of all `Item` objects equipped.
- **totalBp**: The simple sum of the archetype's BP and the BP of all equipped items.
- **adjustedBp**: The final BP cost after applying discounts for multiple items.
- **adjustedItemCosts**: An object that categorizes item costs for calculating `adjustedBp`.
- **finalTraits**: An array of traits from the archetype and items.

### Core Character Stats

- **Physicality**: This represents a character's raw physical power. It is calculated as the higher of the character's Strength (`STR`) or Size (`SIZ`) attributes. The adjusted value, `adjPhysicality`, incorporates trait-based bonuses (like `Brawn X`). When the term "Physicality" is used in rules, it refers to `adjPhysicality`.
- **Durability**: This represents a character's resilience and toughness. It is calculated as the higher of the character's Fortitude (`FOR`) or Size (`SIZ`) attributes. The adjusted value is `adjDurability`. When the term "Durability" is used in rules, it refers to `adjDurability`.

### Burden System

The `burden` property on a profile tracks how much a character is encumbered by their gear.

- **`totalLaden`**: The sum of all `[Laden X]` values from a character's equipped items.
- **`totalBurden`**: Calculated as `totalLaden - adjPhysicality`. If the result is negative, `totalBurden` is 0.

Each point of `totalBurden` applies the following penalties:
- Reduce `MOV` by 1.
- Reduce `REF` by 1 and `CCA` by 1 (unless under an `Attentive` Order).
- Reduce by 1 the level of any Trait with the `Movement` keyword.

### Item Pricing & Limitations

- **Weapon Pricing**: Full BP for the most expensive Melee and Ranged weapon, half cost (rounded up) for all others in those categories.
- **Armor Limitations**: A character may only equip **one** of each type of armor (Helm, Gear, Shield, Suit).
- **Equipment Limitations**: A character is limited to a maximum of **three** items from the Equipment List. The first is full price, duplicates are half price.
- **Hand Limit**: The total hands required by all equipped items (indicated by `[1H]` and `[2H]` traits) cannot exceed 4.

### Common Traits

- **`Brawn X`**: Increases `adjPhysicality` by X.
- **`[Laden X]`**: Contributes X to the character's `totalLaden`.
- **`[1H]` / `[2H]`**: Indicates an item requires one or two hands to use.
