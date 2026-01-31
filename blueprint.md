# Project Blueprint

## Overview

This project is a sophisticated wargame simulation engine built with a modern, data-driven architecture. It features a detailed ruleset, a flexible character and equipment system, and a robust testing suite. The engine is designed to be a pure backend system, with a clear separation between the game logic and the user interface.

## Long-Term Vision

The ultimate goal is to present visuals for the game engine so that it can be played between two or more players, where zero or more of which can be AI bots. This explains the presence of UI files and guides the future development of the front-end components.

## Data Hierarchy

*   **Side:** A set of Assemblies assigned to it which meet the Game size constraints. It is possible that a ~1000 BP "Large game" could be comprised of two ~500 BP "Small game" assemblies. Sides are given unique names for human consumption.
*   **Assembly:** A set of Characters, or a set of Profiles given generic names (or unique identifiers). These are usually built to a specific model count limit and BP cost limit for a Small, Medium, or Large game. Such as 4 to 8 models and no more than 500 BP for a Small game size. Assemblies should be given unique names for human consumption.
*   **Character:** A Profile assigned a unique name (or unique identifier), and possibly additional Traits to differentiate it from a standard Profile.
*   **Profile:** An Archetype assigned Weapons, Armor, and Equipment. Profiles are given unique names.
*   **Archetype:** A set of property values defining a set of Attributes and a list of Traits. The basic set of Archetypes are known as "Common" archetypes, and the `archetypes.json` identifies them.
*   **Variant:** A Common archetype which has been altered through the additional of Traits. The `archetypes.json` identified several "Variants" which use the Veteran archetype and has additional traits and  "bp_add" offset for the total BP value for that archetype.

## Core Systems

### Data Layer

*   **Centralized Data:** The core data for the game (archetypes, weapons, armor, equipment, etc.) is stored in JSON files within the `src/data` directory. This allows for easy modification and expansion of the game's content.
*   **Data Models:** The `src/game/core` directory contains the JavaScript classes that represent the game's core concepts, such as `Character`, `Archetype`, `Weapon`, `Armor`, and `Equipment`. These classes are responsible for loading their data from the JSON files and providing a clean API for accessing and manipulating that data.

### Game Logic

*   **Dice Rolling:** The `src/game/engine/DiceRoller.js` module provides a robust and well-tested system for handling the game's dice-based mechanics.
*   **Action System:** The `src/game/engine/ActionSystem.js` module is responsible for determining which actions are available to a character at any given time and for executing those actions. It has been refactored into a pure backend system.
*   **Other Systems:** The engine includes several other systems for managing various aspects of the game, such as line of sight (`LOSSystem.js`), cover (`CoverSystem.js`), pathfinding (`Pathfinder.js`), and status effects (`TokenSystem.js`, `HindranceTracker.js`).

### Line-of-Sight (LOS) System Enhancements

The existing `LOSSystem.js` has been identified as a candidate for a major refactoring to meet the full requirements of the game's ruleset. The following features need to be clarified, defined, and implemented:

*   **Volumetric Line-of-Sight:**
    *   **Cylinder-to-Cylinder:** The primary LOS check must not be a single point-to-point raycast. It must validate sight between the entire cylindrical volume of the source model and the cylindrical volume of the target model.
    *   **Cylinder-to-Point:** The system must also support checks from a model's volume to a specific coordinate on the battlefield.
    *   **Point-to-Point:** A basic point-to-point check should also be available for other game mechanics.

*   **Detailed Cover Adjudication:** The system must go beyond a simple "blocked" or "not blocked" check. It needs to return detailed information about any obstructions to allow the `ActionSystem` to apply the correct rules. This includes:
    *   **Hard Cover:** Sight is completely blocked by an impassable object (e.g., a wall).
    *   **Soft Cover:** Sight is partially obscured by an object that provides a defensive bonus but does not completely block the shot (e.g., a tree, a vehicle).
    *   **Intervening Cover:** An object is close to the line of fire but not providing direct cover to the target.
    *   **Direct Cover:** The target is physically benefiting from cover.

*   **Game Rule Integration:** The LOS system must provide the necessary hooks to support higher-level character actions and statuses:
    *   **Leaning:** A mechanism to check LOS from a point adjacent to a hard cover object, simulating a character leaning out to shoot.
    *   **Hidden Status:** The system must be able to account for a character's "Hidden" status, which may affect whether they can be targeted even if a technical line of sight exists.

### Testing Mechanics

The `DiceRoller.js` engine has been updated to reflect the detailed testing mechanics of the MEST QSR game system.

*   **Dice Types:**
    *   **Base (White):** 0 successes on 1-3, 1 success on 4-5, 2 successes on 6.
    *   **Modifier (Red):** 0 successes on 1-3, 1 success on 4-6.
    *   **Wild (Yellow):** 0 successes on 1-3, 1 success on 4-5, 3 successes on 6.

*   **Test Types:**
    *   **Opposed Test:** Pits two characters against each other. Each player rolls 2 Base dice plus any bonus dice and adds their relevant attribute.
    *   **Unopposed Test:** Pits a character against the "System". The System rolls 2 Base dice and has a fixed attribute of 2.

*   **Bonus and Penalty Dice:**
    *   Bonuses (+1m, +1b, +1w) add dice to the character's pool.
    *   Penalties (-1m, -1b, -1w) award the corresponding die to the *opposing* player.

*   **Flattening Dice:**
    *   Before rolling, identical dice types in both the active and passive player's pools are canceled out.
    *   A minimum of two Base dice are always retained by each player.

*   **Scoring and Resolution:**
    *   **Test Score:** A player's total score is the sum of their dice successes plus their relevant attribute value.
    *   **Success:** The active character succeeds if their Test Score is greater than or equal to the passive player's score.
    *   **Cascades:** On a success, the number of points by which the active player's score exceeds the passive player's score. A tie results in 0 cascades.
    *   **Misses:** On a failure, the number of points the active player would have needed to tie.
    *   **Difficulty Rating (DR):** A numerical penalty added to the passive player's final Test Score.

*   **Carry-overs:**
    *   **Modifier Dice:** Carry-over as a bonus Modifier die on a roll of 6.
    *   **Base Dice:** Carry-over as a bonus Base die on a roll of 6.
    *   **Wild Dice:** Carry-over as a bonus Wild die on a roll of 4, 5, or 6.
    *   Carry-overs are only applicable from Hit Tests to Damage Tests and from Link Tests to Weave Tests. The System player never receives carry-overs.

### Testing

*   **Unit Tests:** The project uses `vitest` for unit testing. The tests are located in the same directory as the files they test and are named with a `.test.js` suffix.
*   **Comprehensive Coverage:** The tests cover the core data models, the dice rolling system, and other key parts of the game logic.

## Trait Analysis

This section provides a comprehensive list of all traits referenced in the project's data files, along with their occurrence counts. This list is intended to be a long-term reference for understanding the distribution and usage of traits within the game.

| Trait | Count |
|---|---|
| [1H] | 227 |
| [Reveal] | 184 |
| [Laden X=1] | 86 |
| [Feed X=1] | 54 |
| Burst X=2 | 41 |
| ROF X=2 | 38 |
| Burst X=1 | 35 |
| ROF X=3 | 31 |
| [Hafted] | 26 |
| Energy | 26 |
| Blast X=1 | 24 |
| [Reload X=1] | 24 |
| Stun X=1 | 21 |
| [Awkward] | 18 |
| Cleave | 18 |
| [Laden X=2] | 17 |
| Reach | 16 |
| Throwable | 15 |
| Stun X=2 | 14 |
| Light X=2 | 13 |
| [Blackpowder] | 12 |
| ROF X=4 | 10 |
| Light X=1 | 9 |
| Burn X=1 | 9 |
| Blast X=2 | 8 |
| Impale | 8 |
| Discrete | 8 |
| [Stub] | 8 |
| [Reload X=2] | 8 |
| Grit | 7 |
| Light X=3 | 7 |
| Blast X=3 | 6 |
| [Arc X=12] | 6 |
| See X=1 | 5 |
| [Discard > Type] Leadership | 5 |
| Comms X=1 | 5 |
| Poison X=1 | 5 |
| Entangle X=1 | 4 |
| Sharp-shooter | 4 |
| Acid X=2 | 4 |
| Acid X=1 | 4 |
| See X=2 | 4 |
| Heal X=1 | 4 |
| Reinforce X=1 | 4 |
| Scope X=2 | 4 |
| Fight | 3 |
| [2H] | 3 |
| Return | 3 |
| Entangle X=3 | 3 |
| Stun X=3 | 3 |
| See X=3 | 3 |
| Launch X=2 | 3 |
| Poison X=2 | 3 |
| Brawl | 2 |
| ROF X=5 | 2 |
| [Reload X=3] | 2 |
| Silent | 2 |
| Strike | 2 |
| Parry | 2 |
| [Arc X=6] | 2 |
| Blast X=5 | 2 |
| Frag X=5 | 2 |
| Blast X=7 | 2 |
| Blast X=8 | 2 |
| [Stun-only] | 2 |
| [Discard! > Type] Net, Death-net | 2 |
| Hold X=1 | 2 |
| Thresh | 2 |
| [Discard! > Type] Net, Retarius | 2 |
| Hold X=2 | 2 |
| Silent X=1 | 2 |
| Entangle X=2 | 2 |
| [1H/2H] | 2 |
| Brawl X=1 | 2 |
| Brawn X=1 | 2 |
| Quick X=1 | 2 |
| Filter X=2 | 2 |
| Comms X=2 | 2 |
| Damper X=1 | 2 |
| Damper X=2 | 2 |
| Damper X=3 | 2 |
| Synchron X=1 | 2 |
| Flight X=1 | 2 |
| Flight X=2 | 2 |
| [Discard > Type] Monstrum | 2 |
| [Discard > Type] Amulet | 2 |
| [Discard > Type] Ring | 2 |
| [Discard > Type] Stone | 2 |
| [Discard > Type] Trinket | 2 |
| [Discard > Type] Codex, Common | 2 |
| [Discard > Type] Codex, Legendary | 2 |
| [Discard > Type] Scroll, Major | 2 |
| [Discard > Type] Scroll, Minor | 2 |
| [Discard > Type] Tome, Greater | 2 |
| [Discard > Type] Tome, Lesser | 2 |
| Heal X=2 | 2 |
| Jam X=2 | 2 |
| Control X=1 | 2 |
| Teleport X=1 | 2 |
| Teleport X=2 | 2 |
| Jump X=2 | 2 |
| [Laden X=0] | 2 |
| Armor X=2 | 2 |
| Coverage | 2 |
| Deflect | 2 |
| Acid X=3 | 1 |
| ROF X=1 | 1 |
| Frag X=4 | 1 |
| [Arc X=8] | 1 |
| Frag X=7 | 1 |
| Blast X=11 | 1 |
| Frag X=2 |
| [Arc X=2] | 1 |
| Frag X=3 | 1 |
| [Arc X=1] | 1 |
| Frag X=6 | 1 |
| Blast X=10 | 1 |
| [Arc X=4] | 1 |
| Fire-lane | 1 |
| Burst X=3 | 1 |
| [Laden X=3] | 1 |
| [Grenade X=1] | 1 |
| Smoke X=3 | 1 |
| Banish X=1 | 1 |
| Banish X=3 | 1 |
| Banish X=4 | 1 |
| Banish X=5 | 1 |
| Banish X=6 | 1 |
| Banish X=7 | 1 |
| Banish X=8 | 1 |
| Banish X=9 | 1 |
| Perimeter | 1 |
| Charge | 1 |
| Multi-strike X=1 | 1 |
| Resist X > List Anti-electric-1 | 1 |
| Burn X=2 | 1 |
| AP X=1 | 1 |
| AP X=2 | 1 |
| AT X=1 | 1 |
| AT X=2 | 1 |
| HE X=1 | 1 |
| HEAP X=1 | 1 |
| HEAP X=2 | 1 |
| HEAT X=1 | 1 |
| HEAT X=2 | 1 |
| HP X=1 | 1 |
| Tracer X=1 | 1 |
| [Discard > Type] Attachment, Large | 1 |
| [Discard > Type] Attachment, Small | 1 |
| Filter X=1 | 1 |
| See X=4 | 1 |
| Sense X=1 | 1 |
| [Discard > Type] Heirloom | 1 |
| Glide X=1 | 1 |
| Glide X=2 | 1 |
| Arrow X=1 | 1 |
| Dagger X=1 | 1 |
| Scope X=3 | 1 |
| Scope X=4 | 1 |
| Scope X=1 | 1 |
| Target X=1 | 1 |
| Balance X=1 | 1 |
| Masterwork X=1 | 1 |
| Hone X=1 | 1 |
| Bomb X=3 | 1 |
| Bomb X=1 | 1 |
| Bomb X=2 | 1 |
| Bomb X=5 | 1 |
| Bomb X=4 | 1 |
| Mine X=4 | 1 |
| Mine X=5 | 1 |
| Petard X=1 | 1 |
| Powderkeg X=2 | 1 |
| Satchel X=2 | 1 |
| Pulse X=1 | 1 |
| Mine X=1 | 1 |
| Mine X=3 | 1 |
| Mag X=2 | 1 |
| Mine X=2 | 1 |
| Heat X=1 | 1 |
| Immune-Blast X=1 | 1 |
| Immune-Blast X=2 | 1 |
| Grit X=2 | 1 |
| [Stupid] | 1 |
| Focused X=1 | 1 |
| Focused X=2 | 1 |
| [Braggart] | 1 |
| Manapool X=1 | 1 |
| Manapool X=2 | 1 |
| [Delusional | 1 |
| Sturdy X=1 | 1 |
| Sturdy X=2 | 1 |
| [Belligerent] | 1 |
| Frenzy | 1 |
| Brawn X=2 | 1 |
| [Reckless | 1 |
| Brawl X=2 | 1 |
| Resist X=2 | 1 |
| Quick X=2 | 1 |
| [Discard > Type] Scholarship | 1 |
| [Discard > Type] Tactics | 1 |
| [Discard > Type] Assassin | 1 |
| [Discard > Type] Berserker | 1 |
| [Discard > Type] Predict | 1 |
| [Discard > Type] Recon | 1 |
| [Discard > Type] Timer | 1 |
| [Discard > Type] Warrior | 1 |
| [Discard > Type] Prayer-Book | 1 |
| [Discard > Type] Prayer-Relic | 1 |
| Athletics X=1 | 1 |
| Hunting X=1 | 1 |
| [Discard! > Type] Silencer | 1 |
| [Discard! > Type] Silencer, Advanced | 1 |
| Damper X=4 | 1 |
| Synchron X=2 | 1 |
| Synchron X=3 | 1 |
| Counter X=1 | 1 |
| Jam X=1 | 1 |
| Detonate X=1 | 1 |
| Lift X=1 | 1 |
| Carry X=1 | 1 |
| Launch X=1 | 1 |
| Launch X=3 | 1 |
| Regenerate X=1 | 1 |
| Regenerate X=2 | 1 |
| [Prissy] | 1 |
| Reflect X=1 | 1 |
| Manipulate X=1 | 1 |
| System X=1 | 1 |
| Trigger X=1 | 1 |
| Climb X=1 | 1 |
| Jump X=1 | 1 |
| Shoot | 1 |
| Leadership | 1 |
| Tactics | 1 |
| Armor X=4 | 1 |
| [Laden X=4] | 1 |
| Armor X=6 | 1 |
| [Laden X=3] | 1 |
| Armor X=3 | 1 |
| [Laden] | 1 |
| Armor 2 | 1 |
