# Project Blueprint

## Overview

This project is a **headless wargame simulator** designed to run in Firebase Studio. The goal is to create a flexible and performant simulator that can be easily extended with new rules and scenarios, with all interactions occurring via terminal scripts.

## Core Operating Principles

**1. Single Source of Truth:** The project's local files are the absolute and only source of truth. All data, including but not limited to character archetypes, items, weapons, armor, and game rules, MUST be drawn directly from the JSON files in `src/data/` and the markdown files (e.g., `rules.md`).

**2. No Fabrication:** Under no circumstances should information be invented, fabricated, or inferred from external knowledge. If a piece of data (e.g., an item name) does not exist explicitly in the project's files, it cannot be used. Adherence to the project's data is the highest priority.

## Development Principles

**1. Unit Testing as a Priority:** Every new feature, rule, or piece of logic must be accompanied by a comprehensive set of unit tests. All implementation plans must include a dedicated testing phase to ensure correctness and prevent regressions.

**2. Separation of Responsibilities (SOLID):** The codebase will adhere to SOLID design principles, with a strong emphasis on the Single Responsibility Principle. Complex processes, like combat resolution, will be broken down into smaller, modular, and independently testable subroutines. A core function will then act as an orchestrator, managing the flow of data between these subroutines. This ensures a clean, maintainable, and scalable architecture.

## Core Game Mechanics

### Test Resolution

*   **General Rule:** A test (opposed or unopposed) is considered a "pass" if the final calculated `score` is strictly greater than 0. The score is calculated as `(Player 1 Attribute + Player 1 Successes) - (Player 2 Attribute + Player 2 Successes)`.

### Morale Tests

*   **Unopposed:** Morale Tests are a special type of unopposed test.
*   **Success Condition:** A Morale Test is considered a "pass" if the final score is greater than or equal to zero (`score >= 0`). A tie is a pass.
*   **Misses:** The outcome of a Morale Test is not determined by "successes" (cascades), but by "misses". The goal is to avoid accumulating misses.
*   **Tie Result:** A tie on a Morale Test results in a pass with zero misses.

## Reference Documents

*   **`mastery.md`**: This file contains the MEST Tactics QSR System Mastery instructions, serving as a primary guide for interaction.
*   **`rules.md`**: This file contains the canonical game rules, definitions, and modifier tables as provided by the user. It serves as the primary source of truth for all game mechanic implementations.
*   **`persistence.md`**: This file tracks the features to implement for the project's persistence layer.

## Design and Features

### Architecture

*   **Runtime:** Node.js with TypeScript.
*   **Logic:** Core game rules are implemented as modular TypeScript functions.
*   **Data:** Game data (archetypes, items, traits) is stored in JSON files.
*   **Testing:** System is validated by a comprehensive unit test suite using Vitest.

### Existing Features

*   **Data-Driven Design:** Core character and item data is externalized in JSON files.
*   **Character Creation:** A factory (`createCharacter`) builds characters from profiles, applying traits and calculating attributes.
*   **Assembly Factory:** A factory (`createAssembly`) that generates a collection of `Character` objects based on configurable constraints such as minimum/maximum characters and total Budget Points (BP).
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
The monolithic `combat.ts` module was refactored into two distinct, high-level modules: `close-combat.ts` and `ranged-combat.ts`. Both modules leverage shared subroutines for hit and damage tests, adhering to the Single Responsibility Principle.

### **Phase 5: Morale & Compulsory Actions (Completed)**
This phase implemented the game's psychology and morale system, including character state tracking, morale checks, and the determination of compulsory actions based on a character's fear level.

### **Phase 6: Instrumentation & Metrics Framework (Completed)**
This phase marked a strategic shift from pure feature implementation to building a foundational framework for long-term analysis and robust testing. The goal is to create a centralized system for logging and tracking key gameplay events. This will provide immediate value by enabling deterministic, reliable testing and will serve as the core data-gathering mechanism for future game balance analysis.

### **Phase 7: Critical Bug Fix & Rulebook Completion (Completed)**
This phase addressed a critical bug in the combat resolution system and rectified significant omissions in the official `rules.md` documentation.

### **Phase 8: Assembly Factory (Current)**
This phase introduces the concept of an "Assembly," a collection of characters generated within specific constraints. This is the first step towards building a persistence layer and more complex scenario generation.

**The Plan:**

1.  **Define `Assembly` Interface:** Created a new `Assembly.ts` interface to define the data structure for a collection of characters.
2.  **Create `assembly-factory.ts`:** Implemented the core factory logic to generate a valid assembly based on character count and BP constraints.
3.  **Add CLI Command:** Created a `generate-assembly.ts` script and a corresponding `npm run generate-assembly` command to allow for easy generation of assemblies from the command line.
4.  **Update Blueprint:** Updated this `blueprint.md` file to document the new Assembly Factory feature.