# Project Blueprint

## Overview

This project is a simulation engine for a tabletop wargame. The core logic involves parsing character, weapon, and equipment traits from various data sources.

## Current Task: Implement Documented Trait Parser (Simple Forms)

The immediate goal is to implement a parser for the simplest and most common human-readable trait formats. This will serve as the foundation for the more complex parser later.

### **Plan**

1.  **Test-Driven Development (TDD):**
    *   First, create `src/game/core/TraitParser.test.js`.
    *   This test file will define the expected behavior for parsing simple documented traits. Tests will cover:
        *   Binary traits: `"TraitName"`
        *   Binary disabilities: `"[DisabilityName]"`
        *   Traits with explicit levels: `"TraitName X"`
        *   Disabilities with explicit levels: `"[DisabilityName X]"`
        *   Traits with implicit levels (defaulting to 1).

2.  **`TraitParser` Implementation:**
    *   Create `src/game/core/Trait.js` containing:
        *   **`Trait` class:** A data object to store parsed properties (`name`, `level`, `isDisability`).
        *   **`TraitParser` class:** Contains the logic to parse these simple documented trait strings.
    *   The parser will be implemented to pass all tests defined in `TraitParser.test.js`.


## Future Enhancements

### Advanced Documented Trait Parser

After the simple parser is complete, it will be expanded to handle more complex, human-readable trait strings.

**Capabilities will include:**
*   **Complex Dependencies:** Parsing parent-child relationships using `>` and `:` delimiters (e.g., `"Parent > Child"`).
*   **Trait Packages:** Parsing grouped traits within curly braces `{...}`.
*   **Advanced Delimiters:** Handling `.` as a delimiter in trait lists.
*   **Normalization:** Pre-processing non-standard formats like `[A][B]` and `A:B > C`.
*   **Variations:** Parsing trailing characters like `+`, `!`, and `!!` as distinct properties.
*   **Stat-line Targets:** Recognizing and parsing direct stat benefits (e.g., `"Accuracy +1m"`).

### JSON Trait Parser

A separate utility or an extension of the main parser may be needed to handle the specific formats found in the project's `.json` data files (e.g., `"Regenerate X=2"`), if they differ from the documented trait format.
