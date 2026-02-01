# Project Blueprint

## Overview

This project is a **headless wargame simulator** designed to run in Firebase Studio. The goal is to create a flexible and performant simulator that can be easily extended with new rules and scenarios, with all interactions occurring via terminal scripts.

## Core Operating Principles

**1. Single Source of Truth:** The project's local files are the absolute and only source of truth. All data, including but not limited to character archetypes, items, weapons, armor, and game rules, MUST be drawn directly from the JSON files in `src/data/` and the markdown files (e.g., `rules.md`).

**2. No Fabrication:** Under no circumstances should information be invented, fabricated, or inferred from external knowledge. If a piece of data (e.g., an item name) does not exist explicitly in the project's files, it cannot be used. Adherence to the project's data is the highest priority.

## Development Principles

**1. Unit Testing as a Priority:** Every new feature, rule, or piece of logic must be accompanied by a comprehensive set of unit tests. All implementation plans must include a dedicated testing phase to ensure correctness and prevent regressions.

**2. Separation of Responsibilities (SOLID):** The codebase will adhere to SOLID design principles, with a strong emphasis on the Single Responsibility Principle. Complex processes, like combat resolution, will be broken down into smaller, modular, and independently testable subroutines. A core function will then act as an orchestrator, managing the flow of data between these subroutines. This ensures a clean, maintainable, and scalable architecture.

## Reference Documents

*   **`rules.md`**: This file contains the canonical game rules, definitions, and modifier tables as provided by the user. It serves as the primary source of truth for all game mechanic implementations.

## Design and Features

### Architecture

*   **Runtime:** Node.js with TypeScript.
*   **Logic:** Core game rules are implemented as modular TypeScript functions.
*   **Data:** Game data (archetypes, items, traits) is stored in JSON files.
*   **Testing:** System is validated by a comprehensive unit test suite using Vitest.

### Existing Features

*   **Data-Driven Design:** Core character and item data is externalized in JSON files.
*   **Character Creation:** A factory (`createCharacter`) builds characters from profiles, applying traits and calculating attributes.
*   **Core Dice Mechanics:** A `dice-roller.ts` module handles d10-based test resolution.
*   **Trait System:** A flexible system for adding abilities and modifiers to characters and items.
*   **Unit Testing:** A comprehensive Vitest test suite validates all core logic.
*   **Modular Combat System:** The combat logic is cleanly separated into high-level modules for `close-combat.ts` and `ranged-combat.ts`, which in turn use specialized subroutines for hit tests and damage resolution.
*   **Morale & Compulsory Actions:** A system for handling character morale state (Nervous, Disordered, Panicked) and determining the compulsory actions they must take.

---
## Project Phases

### **Phase 1: Initial Simulator Implementation (Completed)**
The foundational phase is complete. We built a headless simulator capable of resolving a basic close combat attack.

### **Phase 2: Trait System Implementation & TDD (Completed)**
This phase implemented the core trait system using a strict Test-Driven Development (TDD) methodology, which was crucial for ensuring code quality and correctness.

### **Phase 3: Situational Test Modifiers (Completed)**
This phase introduced the `TestContext` object, a data container that holds all relevant situational information for a test (e.g., `isCharge`, `isFlanked`, `hasCover`). This architectural change paved the way for a clean and scalable implementation of new rules by decoupling the core test logic from the specifics of any given situation.

### **Phase 4: Combat System Refactor (Completed)**
Building on the `TestContext`, the monolithic `combat.ts` module was refactored into two distinct, high-level modules, adhering to the Single Responsibility Principle.
*   **`close-combat.ts`:** Now exclusively handles all close combat attacks, using the `hit-test.ts` subroutine for its opposed CCA vs. CCA roll. It correctly implements all close-combat-specific modifiers.
*   **`ranged-combat.ts`:** A new module created to exclusively handle all direct ranged attacks. It implements ranged-specific modifiers (e.g., Point-Blank, Cover) and uses its own dedicated `ranged-hit-test.ts` subroutine for the opposed RCA vs. REF roll.
*   **Code Reuse:** Both modules leverage the same `damage-test.ts` subroutine for damage resolution.
*   **Cleanup:** The obsolete `combat.ts` file was deleted.

### **Phase 5: Morale & Compulsory Actions (Completed)**
This phase implemented the game's psychology and morale system.
*   **Character State:** The `Character.ts` interface was updated with `isEngaged` and `isInCover` flags to track a character's immediate situation.
*   **`morale-test.ts` Subroutine:** A new subroutine was created to handle all unopposed `WIL` (Willpower) based morale checks, such as Rally actions.
*   **`compulsory-actions.ts` Module:** This high-level module was created to determine the actions a character must take when their morale breaks. It includes:
    *   **State Utility Functions:** `isNervous`, `isDisordered`, `isPanicked`, and `isEliminatedByFear` provide clean, readable checks for a character's morale status based on their `fearTokens`.
    *   **`getCompulsoryActions` Function:** This core function analyzes a character's state and returns a structured list of required actions (Disengage, Move to Safety, or Rally), including the AP cost, based on the rules of priority. It also handles the automatic elimination of a character who accumulates 4+ fear tokens.

---

### **Phase 6: Next Steps**
The core combat and morale systems are now robust and well-structured. What feature would you like to implement next?
