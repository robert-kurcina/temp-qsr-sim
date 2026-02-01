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
The monolithic `combat.ts` module was refactored into two distinct, high-level modules: `close-combat.ts` and `ranged-combat.ts`. Both modules leverage shared subroutines for hit and damage tests, adhering to the Single Responsibility Principle.

### **Phase 5: Morale & Compulsory Actions (Completed)**
This phase implemented the game's psychology and morale system, including character state tracking, morale checks, and the determination of compulsory actions based on a character's fear level.

### **Phase 6: Instrumentation & Metrics Framework (Current)**
This phase marks a strategic shift from pure feature implementation to building a foundational framework for long-term analysis and robust testing. The goal is to create a centralized system for logging and tracking key gameplay events. This will provide immediate value by enabling deterministic, reliable testing and will serve as the core data-gathering mechanism for future game balance analysis.

**The Plan:**

1.  **Design the `MetricsService`:**
    *   Create a central singleton service, `MetricsService`, responsible for capturing and storing gameplay events.
    *   It will expose a primary method: `logEvent(eventName: string, data: object)`.
    *   It will maintain an in-memory log of all captured events.

2.  **Instrument the Dice Roller:**
    *   The `dice-roller.ts` module will be the first to be instrumented.
    *   Every dice roll will be logged as a `diceRoll` event, capturing all inputs (stats, modifiers) and outputs (success/failure, degrees of success).

3.  **Create a Mockable Testing Framework:**
    *   Refactor the `dice-roller.ts` module to allow its core rolling function to be replaced or "mocked" during tests.
    *   In our test suites, we will replace the random roller with a deterministic one that returns pre-defined results.

4.  **Refactor Combat Tests for Determinism:**
    *   Update the `close-combat.test.ts` and `ranged-combat.test.ts` suites.
    *   Remove statistical loops and unreliable checks.
    *   For each test, we will now inject specific dice roll outcomes (e.g., "force a hit," "force a miss") to validate the code paths with 100% reliability.
