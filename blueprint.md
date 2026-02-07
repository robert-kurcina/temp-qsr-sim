# Project Blueprint

## Overview

This project is a **headless wargame simulator** designed to run in Firebase Studio. The goal is to create a flexible and performant simulator that can be easily extended with new rules and scenarios, with all interactions occurring via terminal scripts.

## Core Operating Principles

**1. Single Source of Truth:** The project's local files are the absolute and only source of truth. All data, including but not limited to character archetypes, items, weapons, armor, and game rules, MUST be drawn directly from the JSON files in `src/data/` and the markdown files (e.g., `rules.md`).

**2. No Fabrication:** Under no circumstances should information be invented, fabricated, or inferred from external knowledge. If a piece of data (e.g., an item name) does not exist explicitly in the project's files, it cannot be used. Adherence to the project's data is the highest priority.

## Development Principles

**1. Unit Testing as a Priority:** Every new feature, rule, or piece of logic must be accompanied by a comprehensive set of unit tests. All implementation plans must include a dedicated testing phase to ensure correctness and prevent regressions.

**2. Separation of Responsibilities (SOLID):** The codebase will adhere to SOLID design principles, with a strong emphasis on the Single Responsibility Principle. Complex processes, like combat resolution, will be broken down into smaller, modular, and independently testable subroutines. A core function will then act as an orchestrator, managing the flow of data between these subroutines. This ensures a clean, maintainable, and scalable architecture.

**3. Strict Debugging Protocol:** When unit tests fail, especially in complex modules like the `dice-roller`, extensive `console.log` statements MUST be added to the relevant functions to trace the execution flow. This data-driven approach is critical for identifying the root cause of the failure before attempting a fix. **These logs MUST NOT be removed until `npm test` confirms that all unit tests are passing.** This ensures a verifiable and robust debugging process.

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

### **Phase 8: Assembly Factory (Completed)**
This phase introduces the concept of an "Assembly," a collection of characters generated within specific constraints. This is the first step towards building a persistence layer and more complex scenario generation.

### **Phase 9: Critical Bug Hunt & Resolution (Completed)**
This phase was dedicated to identifying and resolving critical bugs in the core game mechanics to ensure the simulator is functioning as expected according to the established rules. The work involved a deep dive into the `indirect-ranged-combat.ts` module, correcting a misinterpretation of the automatic miss rule and fixing a bug in how hindrance penalties were applied. The debugging process was guided by our strict protocol of using extensive logging and iterative testing, which ultimately led to the successful resolution of all issues and a full suite of passing tests.

### **Phase 10: Persistence Layer Implementation (LowDB) (In Progress)**
The goal of this phase is to create a robust persistence layer using LowDB to store and manage all generated game data, including Profiles, Characters, and Assemblies.

**The Plan:**

1.  **Install Dependencies:** Add `lowdb` to the project.
2.  **Database Service:** Create a centralized `database.ts` module to manage all interactions with the LowDB instance. This will encapsulate the logic for reading from and writing to the JSON database file.
3.  **Update Factories for Persistence:**
    *   Modify the `character-factory.ts` to automatically save every new `Character` and its associated `Profile` to the database.
    *   Modify the `assembly-factory.ts` to save every new `Assembly` to the database.
4.  **Implement Unique Naming:** Update the `character-factory.ts` to enforce the unique character naming convention (`[A-Z]-[0000-9999]`) as specified in `persistence.md`, checking the database for collisions before creating a new character.
5.  **Create CLI Commands:**
    *   **`query` command:** Build a new Node.js script that allows querying the database for specific objects (e.g., `node query.js --type Character --name A-0001`).
    *   **`export` command:** Build a script to export the results of a query to a specified JSON file (e.g., `node export.js --type Assembly --name "My First Assembly" --out my-assembly.json`).
6.  **Unit Testing:** Write a comprehensive suite of tests for the new `database.ts` service and the CLI commands to ensure data integrity and command functionality.
7.  **Update Blueprint:** Once all steps are complete and tests are passing, mark this phase as completed in the `blueprint.md`.
