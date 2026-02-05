# Persistence Layer

This document outlines the requirements for the project's persistence layer.

## Requirements

1.  **Fast and Stable:** The persistence layer must be performant and reliable.
2.  **Persistence of Generated Configuration Objects:**
    *   All generated `Profile` objects must be persisted.
    *   All generated `Character` objects must be persisted and reference their `Profiles` by a unique identifier.
    *   All generated `Assembly` objects must be persisted.
3.  **New Configuration Object: "Assembly"**
    *   An `Assembly` is a collection of `Character` objects.
    *   **Factory:** An assembly factory will be created to generate assemblies.
    *   **Constraints (Factory Arguments):**
        *   `minCharacters`: Minimum number of characters.
        *   `maxCharacters`: Maximum number of characters.
        *   `minBP`: Minimum total BP (Budget Points).
        *   `maxBP`: Maximum total BP.
    *   **Output:**
        *   A unique Assembly name.
        *   A list of `Character` objects.
        *   `totalBP`: The sum of the BP of all characters in the assembly.
        *   `totalCharacters`: The total number of characters in the assembly.
4.  **CLI Query Command:** A Node.js CLI command to query the persistent store for various objects (Profiles, Characters, Assemblies).
5.  **CLI Export Command:** A Node.js CLI command to export the results of a query to a JSON file.
6.  **Resilience:** The persistent store should be resilient to errors.
