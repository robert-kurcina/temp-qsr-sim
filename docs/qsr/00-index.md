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

### P0 Rules (AI-Critical)

| Rule | File | Clauses | ✅ Complete | ⚠️ Partial | ❌ Missing | Status |
|------|------|---------|-------------|------------|------------|--------|
| **Focus** | `03-actions/03.07-focus.md` | 4 | 4 (100%) | 0 | 0 | ✅ Complete |
| **Detect** | `03-actions/03.05-detect.md` | 10 | 9 (90%) | 1 | 0 | ⚠️ In Progress |
| **Wait** | `03-actions/03.06-wait.md` | 11 | 6 (55%) | 5 | 0 | ⚠️ In Progress |
| **Hide** | `03-actions/03.04-hide.md` | 21 | 4 (19%) | 10 | 7 (33%) | ⚠️ In Progress |
| **Close Combat** | `04-combat/04.01-close-combat.md` | 25 | 8 (32%) | 11 | 6 (24%) | ⚪ Not Started |
| **Range Combat** | `04-combat/04.02-range-combat.md` | 21 | 10 (48%) | 8 | 3 (14%) | ⚪ Not Started |
| **Damage** | `04-combat/04.03-damage.md` | 21 | 19 (90%) | 2 | 0 | ⚪ Not Started |
| **Elimination** | `05-missions/05.01-elimination.md` | 17 | 13 (76%) | 4 | 0 | ⚪ Not Started |
| **AI Decision Rules** | `06-ai/06.01-decision-rules.md` | 43 | 19 (44%) | 17 | 7 (16%) | ⚪ Not Started |
| **P0 Subtotal** | **9 files** | **173** | **92 (53%)** | **57 (33%)** | **24 (14%)** | **In Progress** |

### P1 Rules (Core Gameplay)

| Rule | File | Clauses (est.) | Status |
|------|------|----------------|--------|
| **Initiative** | `02-initiative/02.01-initiative.md` | ~15 | ⚪ Not Started |
| **Activation** | `02-initiative/02.02-activation.md` | ~12 | ⚪ Not Started |
| **Movement** | `03-actions/03.01-move.md` | ~20 | ⚪ Not Started |
| **Morale** | `07-morale/07.01-morale.md` | ~15 | ⚪ Not Started |
| **Visibility** | `01-basics/01.03-visibility.md` | ~12 | ⚪ Not Started |
| **Cover** | `01-basics/01.04-cover.md` | ~10 | ⚪ Not Started |
| **P1 Subtotal** | **6 files** | **~84** | **Not Started** |

### P2 Rules (Advanced/Edge)

| Rule | File | Clauses (est.) | Status |
|------|------|----------------|--------|
| **Advanced Traits** | `08-advanced/08.01-traits.md` | ~50 | ⚪ Not Started |
| **Indirect Combat** | `04-combat/04.04-indirect.md` | ~20 | ⚪ Not Started |
| **Edge Cases** | `09-edge-cases/09.01-index.md` | ~30 | ⚪ Not Started |
| **P2 Subtotal** | **3 files** | **~100** | **Not Started** |

### Overall Summary

| Category | Total Clauses | ✅ Complete | ⚠️ Partial | ❌ Missing | ⚪ Not Started |
|----------|--------------|-------------|------------|------------|----------------|
| **All Rules** | **~357** | **92 (26%)** | **57 (16%)** | **24 (7%)** | **184 (51%)** |

---

## Progress Log

### 2026-03-03: Stage 1 Complete - P0 Clause Tracking

**Completed:**
- ✅ Created `docs/qsr/00-index.md` - Master index (updated)
- ✅ Created `docs/qsr/99-rule-template.md` - Standard template
- ✅ Created `docs/qsr/03-actions/03.06-wait.md` - Wait rule (11 clauses)
- ✅ Created `docs/qsr/03-actions/03.04-hide.md` - Hide rule (21 clauses)
- ✅ Created `docs/qsr/03-actions/03.05-detect.md` - Detect rule (10 clauses)
- ✅ Created `docs/qsr/03-actions/03.07-focus.md` - Focus rule (4 clauses)
- ✅ Created `docs/qsr/04-combat/04.01-close-combat.md` - Close Combat (25 clauses)
- ✅ Created `docs/qsr/04-combat/04.02-range-combat.md` - Range Combat (21 clauses)
- ✅ Created `docs/qsr/04-combat/04.03-damage.md` - Damage (21 clauses)
- ✅ Created `docs/qsr/05-missions/05.01-elimination.md` - Elimination Mission (17 clauses)
- ✅ Created `docs/qsr/06-ai/06.01-decision-rules.md` - AI Decision Rules (43 clauses)
- ✅ Created `docs/qsr/REDUNDANCY_REPORT.md` - Documentation redundancy report

**Archived Redundant Files:**
- `ARCHIVE_QSR_RULES_IMPLEMENTATION_PLAN.md`
- `ARCHIVE_QSR_RULES_IMPLEMENTATION_FINAL.md`
- `ARCHIVE_QSR_RULES_IMPLEMENTATION_COMPLETE.md`
- `ARCHIVE_QSR_HIDE_DETECT_WAIT_COMPLETE_SUMMARY.md`
- `ARCHIVE_HIDE_DETECT_MECHANICS_CORRECTED.md`
- `ARCHIVE_FOCUS_DETECT_CONCENTRATE_COMBO.md`
- `ARCHIVE_HIDE_WAIT_TIMING_AND_SNEAKY_X.md`

**Findings:**
- **P0 Total:** 173 clauses tracked
- **Complete:** 92 (53%)
- **Partial:** 57 (33%) - needs verification
- **Missing:** 24 (14%) - requires implementation

**Critical Gaps Identified:**
- Focus + Detect combo AI prioritization ❌ Missing
- Focus + Concentrate + Detect combo ❌ Missing
- Hide: Visibility×3 rule, mutual exposure rules ❌ Missing
- Wait: Maintenance rules (1 AP if Free) ⚠️ Partial
- Close Combat: Bonus Actions (Pull-back, Reversal) ❌ Missing
- AI Decision Rules: Morale forfeit logic ❌ Missing

**Combos Identified:**
- Focus + Detect (0 AP, +1w) - AI unaware
- Focus + Concentrate + Detect (1 AP, +2w) - AI unaware
- Hide + Wait (defensive setup) - AI unaware
- Sneaky X + Hide + Wait (0 AP defensive) - AI unaware
- Charge + Multiple Weapons (+1m + per weapon) - AI unaware

**Next (Stage 2: Verification):**
1. Map tests to clauses for verification coverage
2. Verify code-to-clause implementation (57 partial)
3. Implement missing clauses (24 missing)
4. Begin P1 rules (Initiative, Activation, Movement, Morale)

---

## Notes

- **Overrides deferred** - Will audit `rules-overrides.md` after initial inventory
- **Secondary sources** - `rules*.md` files are guidance, not canonical
- **Focus on P0 first** - AI-critical rules before core gameplay
