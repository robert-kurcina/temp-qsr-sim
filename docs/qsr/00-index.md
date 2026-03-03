# QSR Master Index

**Purpose:** Map all canonical sources to structured clause tracking

**Last Updated:** 2026-03-03
**Status:** ⚪ In Progress

---

## Canonical Sources

### Primary Canonical (QSR)

| File | Lines | Topic | Priority | Status |
|------|-------|-------|----------|--------|
| `docs/canonical/MEST.Tactics.QSR.txt` | 1-1702 | Core rules | P0 | ⚪ Not Started |
| `docs/canonical/MEST.Tactics.Missions.txt` | 1-??? | Mission rules | P0 | ⚪ Not Started |
| `docs/canonical/MEST.Tactics.Objectives.txt` | 1-??? | Objective rules | P1 | ⚪ Not Started |
| `docs/canonical/MEST.Tactics.MissionKeys.txt` | 1-??? | Victory conditions | P0 | ⚪ Not Started |
| `docs/canonical/MEST.Tactics.Indirect.txt` | 1-??? | Indirect combat | P2 | ⚪ Not Started |
| `docs/canonical/MEST.KOd.txt` | 1-??? | KO rules | P1 | ⚪ Not Started |
| `docs/canonical/MEST.Tactics.Advanced-*.txt` | Various | Advanced rules | P2 | ⚪ Not Started |

### Canonical Data (14 Files)

| File | Topic | Priority | Status |
|------|-------|----------|--------|
| `src/data/archetypes.json` | Character archetypes | P0 | ⚪ Not Audited |
| `src/data/armors.json` | Armor definitions | P1 | ⚪ Not Audited |
| `src/data/bow_weapons.json` | Bow weapons | P1 | ⚪ Not Audited |
| `src/data/equipment.json` | Equipment items | P1 | ⚪ Not Audited |
| `src/data/game_sizes.json` | Game size definitions | P0 | ⚪ Not Audited |
| `src/data/grenade_weapons.json` | Grenade weapons | P2 | ⚪ Not Audited |
| `src/data/item_classification.json` | Item classifications | P1 | ⚪ Not Audited |
| `src/data/item_tech_window.json` | Tech level windows | P2 | ⚪ Not Audited |
| `src/data/keyword_descriptions.json` | Keyword definitions | P1 | ⚪ Not Audited |
| `src/data/melee_weapons.json` | Melee weapons | P0 | ⚪ Not Audited |
| `src/data/ranged_weapons.json` | Ranged weapons | P0 | ⚪ Not Audited |
| `src/data/support_weapons.json` | Support weapons | P2 | ⚪ Not Audited |
| `src/data/tech_level.json` | Tech levels | P2 | ⚪ Not Audited |
| `src/data/terrain_info.json` | Terrain definitions | P1 | ⚪ Not Audited |

### Semi-Canonical (Overrides)

| File | Topic | Priority | Status |
|------|-------|----------|--------|
| `src/guides/docs/rules-overrides.md` | QSR deviations | P0 | ⚪ Not Audited |

### Secondary Sources (Guidance)

| File | Topic | Priority | Status |
|------|-------|----------|--------|
| `src/guides/docs/rules.md` | General rules | P0 | ⚪ Not Audited |
| `src/guides/docs/rules-actions.md` | Action rules | P0 | ⚪ Not Audited |
| `src/guides/docs/rules-ai.md` | AI rules | P0 | ⚪ Not Audited |
| `src/guides/docs/rules-characters-and-attributes.md` | Characters | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-combat.md` | Combat rules | P0 | ⚪ Not Audited |
| `src/guides/docs/rules-cover.md` | Cover rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-dice.md` | Dice rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-engagement.md` | Engagement rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-general-terms.md` | General terms | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-kod.md` | KO rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-los.md` | LOS rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-lof.md` | LOF rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-missions-qai.md` | QAI missions | P0 | ⚪ Not Audited |
| `src/guides/docs/rules-morale.md` | Morale rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-range.md` | Range rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-react.md` | React rules | P0 | ⚪ Not Audited |
| `src/guides/docs/rules-status.md` | Status rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-traits.md` | Trait rules | P1 | ⚪ Not Audited |
| `src/guides/docs/rules-visibility.md` | Visibility rules | P1 | ⚪ Not Audited |

---

## QSR Structure (To Be Created)

### Priority 0: AI-Critical Rules

| Section | File | QSR Lines | Clauses | Status |
|---------|------|-----------|---------|--------|
| **Actions: Wait** | `docs/qsr/03-actions/03.06-wait.md` | 858-865 | ~11 | ⚪ Not Started |
| **Actions: Hide** | `docs/qsr/03-actions/03.04-hide.md` | 846-854 | ~9 | ⚪ Not Started |
| **Actions: Detect** | `docs/qsr/03-actions/03.05-detect.md` | 855-857 | ~6 | ⚪ Not Started |
| **Actions: Focus** | `docs/qsr/03-actions/03.07-focus.md` | 859 | ~3 | ⚪ Not Started |
| **Combat: Close Combat** | `docs/qsr/04-combat/04.01-close-combat.md` | 1051-1150 | ~25 | ⚪ Not Started |
| **Combat: Range Combat** | `docs/qsr/04-combat/04.02-range-combat.md` | 1151-1250 | ~25 | ⚪ Not Started |
| **Combat: Damage** | `docs/qsr/04-combat/04.03-damage.md` | 1251-1350 | ~20 | ⚪ Not Started |
| **Missions: Elimination** | `docs/qsr/05-missions/05.01-elimination.md` | TBD | ~15 | ⚪ Not Started |
| **AI: Decision Rules** | `docs/qsr/06-ai/06.01-decision-rules.md` | Derived | ~20 | ⚪ Not Started |

### Priority 1: Core Gameplay Rules

| Section | File | QSR Lines | Clauses | Status |
|---------|------|-----------|---------|--------|
| **Initiative** | `docs/qsr/02-initiative/02.01-initiative.md` | 751-850 | ~15 | ⚪ Not Started |
| **Activation** | `docs/qsr/02-initiative/02.02-activation.md` | 781-800 | ~12 | ⚪ Not Started |
| **Movement** | `docs/qsr/03-actions/03.01-move.md` | 871-900 | ~20 | ⚪ Not Started |
| **Morale** | `docs/qsr/07-morale/07.01-morale.md` | 1351-1450 | ~15 | ⚪ Not Started |
| **Visibility** | `docs/qsr/01-basics/01.03-visibility.md` | 651-700 | ~12 | ⚪ Not Started |
| **Cover** | `docs/qsr/01-basics/01.04-cover.md` | 701-750 | ~10 | ⚪ Not Started |

### Priority 2: Advanced/Edge Rules

| Section | File | QSR Lines | Clauses | Status |
|---------|------|-----------|---------|--------|
| **Advanced Traits** | `docs/qsr/08-advanced/08.01-traits.md` | Various | ~50 | ⚪ Not Started |
| **Indirect Combat** | `docs/qsr/04-combat/04.04-indirect.md` | TBD | ~20 | ⚪ Not Started |
| **Edge Cases** | `docs/qsr/09-edge-cases/09.01-index.md` | Various | ~30 | ⚪ Not Started |

---

## Implementation Status Summary

| Category | Total | ✅ Complete | ⚠️ Partial | ❌ Missing | ⚪ Not Started |
|----------|-------|-------------|------------|------------|----------------|
| **P0 Rules** | ~9 | 1 | 3 | 0 | 5 |
| **P1 Rules** | ~6 | 0 | 0 | 0 | 6 |
| **P2 Rules** | ~3 | 0 | 0 | 0 | 3 |
| **Total** | **~18** | **1** | **3** | **0** | **14** |

---

## Progress Log

### 2026-03-03: Stage 1 Started

**Completed:**
- ✅ Created `docs/qsr/00-index.md` - Master index
- ✅ Created `docs/qsr/99-rule-template.md` - Standard template
- ✅ Created `docs/qsr/03-actions/03.06-wait.md` - Wait rule (11 clauses)
- ✅ Created `docs/qsr/03-actions/03.04-hide.md` - Hide rule (21 clauses)
- ✅ Created `docs/qsr/03-actions/03.05-detect.md` - Detect rule (10 clauses)
- ✅ Created `docs/qsr/03-actions/03.07-focus.md` - Focus rule (4 clauses)

**Findings:**
- Wait: 6/11 clauses ✅ complete, 5/11 need verification
- Hide: 4/21 clauses ✅ complete, 10/21 need verification, 7/21 ❌ missing
- Detect: 9/10 clauses ✅ complete, 1/10 needs verification
- Focus: 4/4 clauses ✅ complete

**Combos Identified:**
- Focus + Detect (0 AP, +1w)
- Focus + Concentrate + Detect (1 AP, +2w)
- Hide + Wait (defensive setup)
- Sneaky X + Hide + Wait (0 AP defensive)

**Next:**
- Complete P0 rules (Combat, Missions, AI decision rules)
- Begin Stage 2 for Wait, Detect, Focus
- Address Hide gaps (7 missing clauses)

---

## Notes

- **Overrides deferred** - Will audit `rules-overrides.md` after initial inventory
- **Secondary sources** - `rules*.md` files are guidance, not canonical
- **Focus on P0 first** - AI-critical rules before core gameplay
