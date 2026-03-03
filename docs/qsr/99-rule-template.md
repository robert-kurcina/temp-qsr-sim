# Rule Template

**Purpose:** Standard template for QSR rule clause tracking

---

## Rule: [Rule Name]

**Canonical Source:** `docs/canonical/[File].txt` (Lines XXX-YYY)

**Secondary Sources:**
- `src/guides/docs/rules-*.md` - [Topic]
- `src/guides/docs/rules-overrides.md` - [Override name] (if applicable)

**Related Data:**
- `src/data/[file].json` - [Data type]

**Last Synced:** 2026-03-03
**Sync Status:** ⚪ Not Started / ⚠️ In Progress / ✅ Complete

---

## Clauses

| ID | Text | Priority | AI-Critical | Override? | Status |
|----|------|----------|-------------|-----------|--------|
| XXX.1 | [Clause text from QSR] | P0/P1/P2 | ✅/❌ | ✅/❌ | ⚪ |
| XXX.2 | [Clause text from QSR] | P0/P1/P2 | ✅/❌ | ✅/❌ | ⚪ |

---

## Referents

| Name | Type | Definition | QSR Line | Codified | Verified |
|------|------|------------|----------|----------|----------|
| [Name] | Cost/Condition/State/Attribute/Action | [Definition from QSR] | Line | `file.ts:line` | ✅/⚠️/❌ |

---

## System Mastery Nuances (Combos)

| Combo | Components | Benefit | AI Aware | Codified |
|-------|------------|---------|----------|----------|
| [Name] | [Component 1] + [Component 2] | [Quantified benefit] | ✅/❌ | `file.ts:line` |

---

## Implementation Status

| Clause | Code Location | Test Location | Status | Notes |
|--------|--------------|---------------|--------|-------|
| XXX.1 | `file.ts:line` | `test.ts:line` | ✅/⚠️/❌ | [Notes] |
| XXX.2 | `file.ts:line` | `test.ts:line` | ✅/⚠️/❌ | [Notes] |

---

## Redundancy Check

| File | Type | Status | Action |
|------|------|--------|--------|
| `docs/blueprint/[file].md` | Planning | ⚪ Review | Keep/Merge/Delete |
| `docs/implementation/[file].md` | Technical | ⚪ Review | Keep/Merge |
| `docs/audit/[file].md` | Audit | ⚪ Review | Keep/Archive |

---

## Notes

[Any additional context, decisions, or open questions]
