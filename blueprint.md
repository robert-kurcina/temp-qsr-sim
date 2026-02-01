# Project Blueprint

## Overview

This project is a **headless wargame simulator** designed to run in Firebase Studio. The goal is to create a flexible and performant simulator that can be easily extended with new rules and scenarios, with all interactions occurring via terminal scripts.

## Core Operating Principles

**1. Single Source of Truth:** The project's local files are the absolute and only source of truth. All data, including but not limited to character archetypes, items, weapons, armor, and game rules, MUST be drawn directly from the JSON files in `src/data/` and the markdown files (e.g., `rules.md`).

**2. No Fabrication:** Under no circumstances should information be invented, fabricated, or inferred from external knowledge. If a piece of data (e.g., an item name) does not exist explicitly in the project's files, it cannot be used. Adherence to the project's data is the highest priority.

## Reference Documents

*   **`rules.md`**: This file contains the canonical game rules, definitions, and modifier tables as provided by the user. It serves as the primary source of truth for all game mechanic implementations.

## Design and Features

### Architecture

*   **Runtime:** Node.js with TypeScript.
*   **Logic:** Core game rules are implemented as modular TypeScript functions.
*   **Data:** Game data (archetypes, items, traits) is stored in JSON files.

### Existing Features

*   **Data-Driven Design:** Core character and item data is externalized in JSON files, allowing for easy modification.
*   **Character Creation:** A factory function (`createCharacter`) builds character objects from profiles, applying traits and calculating final attributes.
*   **Core Dice Mechanics:** A robust `dice-roller.ts` module handles the fundamental d10-based test resolution, including cascades and misses.
*   **Basic Combat Simulation:** The `combat.ts` module orchestrates a full combat sequence (`makeCloseCombatAttack`), from the initial opposed hit test to the final unopposed damage test, including carry-over dice logic.
*   **Unit Testing:** The system is validated via a Vitest test (`combat.test.ts`), which runs a headless simulation and logs the detailed results.

## Current Request: Implement Situational Test Modifiers

**Goal:** Evolve the simulator to account for common battlefield situations that grant bonus or penalty dice to tests. This involves implementing the logic described in the `rules.md` file.

---

### **Phase 1: Initial Simulator Implementation (Completed)**

The foundational phase is complete. We have successfully built and validated a headless simulator capable of resolving a basic close combat attack between two characters, including dice rolling, attribute tests, and wound calculation.

---

### **Phase 2: Situational Test Modifiers (In Progress)**

This phase introduces a new layer of contextual logic to the simulation.

#### **High-Level Plan: The "Test Context" Object**

The central architectural change will be the introduction of a `TestContext` object. This object will act as a data container, holding all relevant information about a test beyond just the attacker and defender. It will be constructed before a test is resolved and passed into the core logic. This prevents a tangled mess of function parameters and allows for clean, scalable implementation of new rules.

#### **Iterative Implementation Steps**

1.  **Foundational Refactoring:**
    *   **Extend Character State:** The `Character` interface's `state` property will be expanded to track new conditions required by the rules (e.g., `fearTokens: number`, `delayTokens: number`, `isHidden: boolean`, `isWaiting: boolean`).
    *   **Introduce `TestContext`:** Define a `TestContext` interface that can hold flags and data for various situations (e.g., `isCharge: boolean`, `isFlanked: boolean`, `elevationAdvantage: number`, `distance: number`).
    *   **Refactor `resolveTest`:** The function signature will be updated to `resolveTest(..., context: TestContext)`.
    *   **Create `calculateSituationalModifiers`:** A new, pure function will be created. It will take the `TestContext` as input and return an object containing the total dice modifications (`{ base: 0, modifier: 0, wild: 0, impact: 0 }`). This keeps the modifier logic separate and testable.

2.  **Implement Character-State & Action-Based Modifiers:**
    *   These modifiers rely on the state of the characters or the action being performed, making them the easiest to implement first.
    *   **Hindrance:** The most common modifier. The logic will be updated to add a -1 Modifier die for each Wound, Fear, and Delay token.
    *   **Action Flags:** The `TestContext` will be populated with flags like `isDefending`, `isCharging`, `isOverreach`. The test runner will be updated to set these flags to simulate different actions.
    *   **State Flags:** Implement `Suddenness` (from `isHidden`), `Focus` (from `isWaiting`), and `Solo`.

3.  **Implement Spatial & Environmental Modifiers (Abstracted Approach):**
    *   A full geometric simulation of a 3D battlefield is outside the current scope. To avoid this complexity, we will use an **abstracted approach**. The test runner will be responsible for *declaring* the spatial conditions rather than calculating them.
    *   **Mock Spatial Data:** The `TestContext` will be populated with pre-calculated spatial data (e.g., `isFlanked: true`, `hasHighGround: true`, `coverType: 'Direct'`).
    *   **Implement Modifier Logic:** With the context providing the necessary data, the `calculateSituationalModifiers` function will be updated to handle the logic for:
        *   **Close Combat:** `Assist`, `High Ground`, `Size`, `Outnumber`, `Cornered`, `Flanked`.
        *   **Ranged Combat:** `Point-blank`, `Elevation`, `Size`, `Distance`, `Intervening Cover`, `Direct Cover`, `Hard Cover`.

This iterative plan allows us to systematically build the complex modifier system, ensuring each piece is logical and testable, without getting bogged down in premature geometric calculations.
