# MEST Tactics Simulator - Documentation Index

**Last Updated:** 2026-03-02

---

## Quick Navigation

| Category | Purpose | Files |
|----------|---------|-------|
| [📘 Blueprint](#blueprint) | Project planning, phases, roadmap | 13 files |
| [📜 QSR Documentation](#qsr-documentation) | QSR rules traceability and tests | 4 files |
| [🔍 Audit Reports](#audit-reports) | Implementation audits and compliance | 4 files |
| [📚 Reference](#reference) | Cross-reference and lookup tables | 1 file |
| [🏗️ Project Docs](#project-documentation) | Architecture, changelog, contributing | 6 files |
| [📄 Canonical Sources](#canonical-sources) | Original QSR source texts | 25 files |

---

## 📘 Blueprint

**Location:** [`blueprint/`](blueprint/)

Project planning, phase tracking, and implementation roadmap.

| File | Description |
|------|-------------|
| [blueprint/README.md](blueprint/README.md) | Navigation index for blueprint docs |
| [blueprint/01-overview.md](blueprint/01-overview.md) | Overview, Operating Principles, Environment |
| [blueprint/02-game-docs.md](blueprint/02-game-docs.md) | Game Documentation References |
| [blueprint/03-current-task.md](blueprint/03-current-task.md) | Current Task, Gaps, Prioritized Plan |
| [blueprint/phases/phase-0-qsr-rules.md](blueprint/phases/phase-0-qsr-rules.md) | Phase 0: QSR Rules Gap Closure |
| [blueprint/phases/phase-1-engine.md](blueprint/phases/phase-1-engine.md) | Phase 1: Core Engine Stability |
| [blueprint/phases/phase-2-ai-foundation.md](blueprint/phases/phase-2-ai-foundation.md) | Phase 2: AI Foundation |
| [blueprint/phases/phase-2-subphases.md](blueprint/phases/phase-2-subphases.md) | Phase 2.1-2.7: AI Sub-phases |
| [blueprint/phases/phase-3-ai-tactical.md](blueprint/phases/phase-3-ai-tactical.md) | Phase 3: AI Tactical Intelligence |
| [blueprint/phases/phase-4-validation.md](blueprint/phases/phase-4-validation.md) | Phase 4: Validation & Testing |
| [blueprint/phases/phase-a0-visual-audit.md](blueprint/phases/phase-a0-visual-audit.md) | Phase A0: Visual Audit API |
| [blueprint/phases/phase-r-terrain.md](blueprint/phases/phase-r-terrain.md) | Phase R: Terrain Placement Refactoring |
| [blueprint/phases/phase-s-consolidation.md](blueprint/phases/phase-s-consolidation.md) | Phase S: Battle Script Consolidation |
| [blueprint/phases/future-phases.md](blueprint/phases/future-phases.md) | Future Phases (I+) |

---

## 📜 QSR Documentation

**Location:** [`qsr/`](qsr/)

QSR rules traceability matrices and test coverage tracking.

| File | Description |
|------|-------------|
| [qsr/traceability.md](qsr/traceability.md) | Maps QSR.txt → rules docs → runtime code |
| [qsr/trait-tests.md](qsr/trait-tests.md) | Test coverage for 100+ traits (QSR + Advanced) |
| [qsr/bonus-action-tests.md](qsr/bonus-action-tests.md) | Test coverage for 8 Bonus Actions |
| [qsr/passive-options-tests.md](qsr/passive-options-tests.md) | Test coverage for 7 Passive Player Options |

---

## 🔍 Audit Reports

**Location:** [`audit/`](audit/)

Implementation audits tracking QSR compliance and remediation.

| File | Description |
|------|-------------|
| [audit/hardcoded-distances.md](audit/hardcoded-distances.md) | Distance compliance audit (MOV/Visibility-based) |
| [audit/agility-hands.md](audit/agility-hands.md) | Hand requirements in Agility actions |
| [audit/falling-tactics.md](audit/falling-tactics.md) | Falling rules and AI awareness implementation |
| [audit/running-jump.md](audit/running-jump.md) | Running jump and gap-crossing mechanics |

---

## 📚 Reference

**Location:** [`reference/`](reference/)

Cross-reference and lookup tables.

| File | Description |
|------|-------------|
| [reference/advanced-traits.md](reference/advanced-traits.md) | 90+ advanced traits mapping to rules docs |

---

## 🏗️ Project Documentation

**Location:** [`project/`](project/)

General project documentation (not QSR-specific).

| File | Description |
|------|-------------|
| [project/ARCHITECTURE.md](project/ARCHITECTURE.md) | System architecture and module breakdown |
| [project/CHANGELOG.md](project/CHANGELOG.md) | Version history and release notes |
| [project/CONTRIBUTING.md](project/CONTRIBUTING.md) | Contribution guidelines |
| [project/battlefield-data-analysis.md](project/battlefield-data-analysis.md) | Battlefield data architecture analysis |
| [project/items-analysis.md](project/items-analysis.md) | Items data structure analysis |
| [project/visual-audit-checklist.md](project/visual-audit-checklist.md) | Visual audit system test checklist |

---

## 📄 Canonical Sources

**Location:** [`canonical/`](canonical/)

Original QSR source texts and data mappings.

### Rules Sources
| File | Description |
|------|-------------|
| [canonical/MEST.Tactics.QSR.txt](canonical/MEST.Tactics.QSR.txt) | Quick Start Rules (primary source) |
| [canonical/MEST.Tactics.Indirect.txt](canonical/MEST.Tactics.Indirect.txt) | Indirect Combat rules |
| [canonical/MEST.Tactics.Missions.txt](canonical/MEST.Tactics.Missions.txt) | Mission rules |
| [canonical/MEST.Tactics.Objectives.txt](canonical/MEST.Tactics.Objectives.txt) | Objective Marker rules |
| [canonical/MEST.Tactics.MissionKeys.txt](canonical/MEST.Tactics.MissionKeys.txt) | Mission scoring keys |
| [canonical/MEST.KOd.txt](canonical/MEST.KOd.txt) | KO'd Attacks rules |
| [canonical/MEST.Armor.Materials.txt](canonical/MEST.Armor.Materials.txt) | Armor materials reference |

### Advanced Rules Modules
| File | Description |
|------|-------------|
| [canonical/MEST.Tactics.Advanced-ROF.txt](canonical/MEST.Tactics.Advanced-ROF.txt) | Rate of Fire rules |
| [canonical/MEST.Tactics.Advanced-Suppression.txt](canonical/MEST.Tactics.Advanced-Suppression.txt) | Suppression rules |
| [canonical/MEST.Tactics.Advanced-Fire.txt](canonical/MEST.Tactics.Advanced-Fire.txt) | Fire rules |
| [canonical/MEST.Tactics.Advanced-Firelane.txt](canonical/MEST.Tactics.Advanced-Firelane.txt) | Firelane rules |
| [canonical/MEST.Tactics.Advanced-Effects.txt](canonical/MEST.Tactics.Advanced-Effects.txt) | Effects/Hindrances rules |
| [canonical/MEST.Tactics.Advanced-Gas.Fume.Puffs.txt](canonical/MEST.Tactics.Advanced-Gas.Fume.Puffs.txt) | Gas/Fume/Puffs rules |
| [canonical/MEST.Tactics.Advanced-Go.txt](canonical/MEST.Tactics.Advanced-Go.txt) | Go Points rules |
| [canonical/MEST.Tactics.Advanced-Champions.txt](canonical/MEST.Tactics.Advanced-Champions.txt) | Champions rules |
| [canonical/MEST.Tactics.Advanced-LoA.txt](canonical/MEST.Tactics.Advanced-LoA.txt) | Legends of Achievement rules |
| [canonical/MEST.Tactics.Advanced-Terrain.txt](canonical/MEST.Tactics.Advanced-Terrain.txt) | Terrain rules |
| [canonical/MEST.Tactics.Advanced-Buildings.txt](canonical/MEST.Tactics.Advanced-Buildings.txt) | Buildings rules |
| [canonical/MEST.Tactics.Advanced-Lighting.txt](canonical/MEST.Tactics.Advanced-Lighting.txt) | Lighting rules |
| [canonical/MEST.Tactics.Advanced-Webbing.txt](canonical/MEST.Tactics.Advanced-Webbing.txt) | Webbing rules |
| [canonical/MEST.Tactics.Advanced-Technology.txt](canonical/MEST.Tactics.Advanced-Technology.txt) | Technology rules |

### Data Mappings
| File | Description |
|------|-------------|
| [canonical/tech_level_REVISED.json](canonical/tech_level_REVISED.json) | Tech level definitions |
| [canonical/item_tech_window.json](canonical/item_tech_window.json) | Item tech window mappings |
| [canonical/MEST.items-by-tech.csv](canonical/MEST.items-by-tech.csv) | Items by tech level (CSV) |
| [canonical/MEST.Items-by-tech.json](canonical/MEST.Items-by-tech.json) | Items by tech level (JSON) |

---

## Related Directories

| Directory | Purpose |
|-----------|---------|
| [`src/guides/docs/`](../src/guides/docs/) | Modular QSR rules documentation |
| [`src/data/`](../src/data/) | Game data (archetypes, items, weapons, armors) |
| [`assets/`](../assets/) | Visual assets (portraits, SVG tokens) |
| [`generated/`](../generated/) | Generated output (battle reports, SVG) |

---

## Documentation Categories Explained

| Category | Naming Convention | Purpose |
|----------|-------------------|---------|
| **Blueprint** | `phase-*.md`, `NN-*.md` | Project planning and phases |
| **QSR** | `kebab-case.md` | QSR rules traceability and tests |
| **Audit** | `kebab-case.md` | Implementation audits |
| **Reference** | `kebab-case.md` | Cross-reference tables |
| **Project** | `ALL_CAPS.md` or `kebab-case.md` | General project docs |
| **Canonical** | `MEST.*.txt`, `*.json` | Original source documents |

---

## For LLM Agents

**When referencing documentation:**

1. **QSR Rules:** Use [`src/guides/docs/rules.md`](../src/guides/docs/rules.md) as primary source
2. **Traceability:** Check [`qsr/traceability.md`](qsr/traceability.md) for rule → code mapping
3. **Test Coverage:** See [`qsr/trait-tests.md`](qsr/trait-tests.md), [`qsr/bonus-action-tests.md`](qsr/bonus-action-tests.md)
4. **Compliance Audits:** Check [`audit/`](audit/) for specific implementation audits
5. **Project Status:** See [`blueprint/03-current-task.md`](blueprint/03-current-task.md)

**Rule Precedence:**
1. `src/guides/docs/rules-overrides.md`
2. `src/guides/docs/rules*.md`
3. `docs/canonical/*.txt`
