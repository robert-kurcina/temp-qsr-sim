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
*   **Testing:** System is validated by a comprehensive unit test suite using Vitest.

### Existing Features

*   **Data-Driven Design:** Core character and item data is externalized in JSON files, allowing for easy modification.
*   **Character Creation:** A factory function (`createCharacter`) builds character objects from profiles, applying traits and calculating final attributes.
*   **Core Dice Mechanics:** A robust `dice-roller.ts` module handles the fundamental d10-based test resolution, including cascades and misses.
*   **Basic Combat Simulation:** The `combat.ts` module orchestrates a full combat sequence (`makeCloseCombatAttack`), from the initial opposed hit test to the final damage test and wound calculation.
*   **Trait System:** A flexible system for adding special abilities and modifiers to characters and items.
    *   **Trait Parsing:** A `trait-parser.ts` module correctly parses various trait string formats into structured `Trait` objects.
    *   **Trait Logic Registry:** A `trait-logic-registry.ts` allows for associating traits with specific, testable game logic.
    *   **Attribute Modifiers:** The first trait logic, `attribute-modifier`, is implemented and tested, allowing traits like `STR +1` to correctly modify a character's final attributes.
*   **Unit Testing:** The system is validated via a Vitest test suite that runs headless simulations and logs detailed results.

---
## Project Phases

### **Phase 1: Initial Simulator Implementation (Completed)**

The foundational phase is complete. We have successfully built and validated a headless simulator capable of resolving a basic close combat attack between two characters, including dice rolling, attribute tests, and wound calculation.

---

### **Phase 2: Trait System Implementation & TDD (Completed)**

This phase implemented the core trait system using a strict Test-Driven Development (TDD) methodology, which proved crucial in ensuring code quality and correctness.

**TDD Workflow & Bug Fixes:**

1.  **Initial Goal:** Implement and test the `attribute-modifier` trait logic.
2.  **Bug Discovery #1 (`trait-parser.ts`):** Writing tests for the `attribute-modifier` revealed that the underlying `trait-parser` was buggy. It was assigning numeric trait levels to a `value` property instead of the correct `level` property.
3.  **Red-Green-Refactor #1:**
    *   **Red:** Wrote specific unit tests for `trait-parser.ts` that failed, confirming the bug.
    *   **Green:** Fixed the bug in `trait-parser.ts` by assigning the numeric value to `trait.level`. All tests for the parser passed.
4.  **Bug Discovery #2 (`character-factory.ts`):** Running the full test suite after the first fix revealed new failures in `combat.test.ts`. This indicated a dependent bug—another part of the system relied on the parser's incorrect behavior.
5.  **Root Cause Analysis:** Investigation showed that `character-factory.ts` was not applying armor to characters because it was still looking for the old `trait.value` property when calculating armor values.
6.  **Red-Green-Refactor #2:**
    *   **Red:** The existing `combat.test.ts` failures served as our "Red" state.
    *   **Green:** Fixed the bug in `character-factory.ts` to correctly use `trait.level`.
7.  **Final Confirmation:** The entire test suite of 36 tests was run one final time, with all tests passing.

This phase successfully delivered a robust and well-tested Trait system and reinforced the project's commitment to a high standard of code quality through TDD.

---

### **Phase 3: Situational Test Modifiers (Next)**

This phase will introduce a new layer of contextual logic to the simulation based on the `rules.md` file.

#### **High-Level Plan: The "Test Context" Object**

The central architectural change will be the introduction of a `TestContext` object. This object will act as a data container, holding all relevant information about a test beyond just the attacker and defender. It will be constructed before a test is resolved and passed into the core logic. This prevents a tangled mess of function parameters and allows for clean, scalable implementation of new rules.

#### **Iterative Implementation Steps**

1.  **Foundational Refactoring:**
    *   **Extend Character State:** The `Character` interface's `state` property will be expanded to track new conditions required by the rules (e.g., `fearTokens: number`, `delayTokens: number`, `isHidden: boolean`, `isWaiting: boolean`).
    *   **Introduce `TestContext`:** Define a `TestContext` interface that can hold flags and data for various situations (e.g., `isCharge: boolean`, `isFlanked: boolean`, `elevationAdvantage: number`, `distance: number`).
    *   **Refactor `resolveTest`:** The function signature will be updated to `resolveTest(..., context: TestContext)`.
    *   **Create `calculateSituationalModifiers`:** A new, pure function will be created. It will take the `TestContext` as input and return an object containing the total dice modifications.

2.  **Implement Character-State & Action-Based Modifiers:**
    *   **Hindrance:** Update logic to add a -1 Modifier die for each Wound, Fear, and Delay token.
    *   **Action Flags:** Use the `TestContext` to handle flags like `isDefending`, `isCharging`, `isOverreach`.
    *   **State Flags:** Implement `Suddenness` (from `isHidden`), `Focus` (from `isWaiting`), and `Solo`.

3.  **Implement Spatial & Environmental Modifiers (Abstracted Approach):**
    *   To avoid the complexity of a full 3D battlefield simulation, the test runner will be responsible for *declaring* spatial conditions in the `TestContext` (e.g., `isFlanked: true`, `hasHighGround: true`, `coverType: 'Direct'`).
    *   With the context providing the data, the modifier logic will be updated to handle rules for Close Combat (`Assist`, `High Ground`, `Size`, etc.) and Ranged Combat (`Point-blank`, `Elevation`, `Cover`, etc.).
