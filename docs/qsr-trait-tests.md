# QSR Trait Tests

**Last Updated:** February 26, 2026
**Source:** `docs/MEST.Tactics.QSR.txt`, `src/data/trait_descriptions.json`

This document tracks unit test coverage for all Traits in MEST Tactics. Traits are split into two sections:
- **QSR Traits:** Traits defined in MEST.Tactics.QSR.txt (Quick Start Rules)
- **Advanced Traits:** Traits only in trait_descriptions.json (not in QSR)

**Legend:**
- ✅ **DONE** - Unit test exists and passes
- ⏳ **PENDING** - Unit test needed

---

## QSR Traits

These traits are defined in the Quick Start Rules (MEST.Tactics.QSR.txt).

| Trait | Description | Test File | Status |
|-------|-------------|-----------|--------|
| **Armor X** | Reduce Wound tokens by AR. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Brawl X** | Bonus actions on failed Close Combat Hit Test. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Brawn X** | +X to Physicality (not Damage). | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Cleave X** | KO'd target is Eliminated instead. X≥2 adds (X-1) wounds. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Deflect X** | +X Modifier dice vs Range Combat Hit Tests. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Fight X** | Bonus actions on successful Hit Test. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Grit** | Ignore first Wound each Turn. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Knife-fighter X** | Bonus in Scrum (base-contact with 2+ enemies). | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Leadership X** | Cohesion benefits, Rally bonuses. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Natural X** | Weapon is part of model (no hands, no delay). | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Parry X** | +X Modifier dice for Defender Close Combat Hit Tests. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Reach X** | +X MU Melee Range. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Shoot X** | Bonus actions on successful Range Combat Hit Test. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Stun X** | Delay tokens as Stun damage on hit. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Tough X** | +X to Durability. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Impact X** | Reduces target AR by X. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **[1H]** | One-handed weapon. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **[2H]** | Two-handed weapon. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **[Laden X]** | Burden if exceeds Physicality. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **Throwable** | Can be thrown (STR OR). | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **Discrete** | Concealed, no hand requirement. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **Reload X** | Requires reload after use. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **ROF X** | Rate of Fire - multiple attacks. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **Coverage** | Armor protects from all directions. | `src/lib/mest-tactics/traits/combat-traits.test.ts` | ✅ DONE |
| **[Awkward]** | Attack Effect - extra AP in base-contact. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **[Blinders]** | Intrinsic - Scrum penalty, no Bow. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **[Discard]** | Asset - limited uses. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **[Hafted]** | -1 Modifier die Defender Close Combat. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **[Lumbering]** | Intrinsic - Base die penalties when flanked. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **[Stub]** | Short range, no Overreach. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **Bash** | Asset - cascade bonus on Charge. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |
| **Acrobatic X** | Genetic - +X Wild dice Defender Close Combat. | `src/lib/mest-tactics/traits/item-traits.test.ts` | ✅ DONE |

---

## Advanced Traits

These traits are only in trait_descriptions.json (not in QSR).

| Trait | Description | Test File | Status |
|-------|-------------|-----------|--------|
| **[Addicted X > Type]** | Psychology - penalty without substance. | - | ⏳ PENDING |
| **[Arc X]** | Attack Effect - indirect attack rules. | - | ⏳ PENDING |
| **[Automaton!]** | Intrinsic - no IP, Reacts, Bonus Actions. | - | ⏳ PENDING |
| **[Automaton]** | Intrinsic - basic automaton. | - | ⏳ PENDING |
| **[Automaton+]** | Intrinsic - scholar automaton. | - | ⏳ PENDING |
| **[Awkward]** | Attack Effect - extra AP in base-contact. | - | ⏳ PENDING |
| **[Backblast X]** | Attack Effect - models behind take Burned. | - | ⏳ PENDING |
| **[Bad Technique]** | Close Combat -1 Modifier die. | - | ⏳ PENDING |
| **[Beast!]** | Genetic - beast with full restrictions. | - | ⏳ PENDING |
| **[Beast]** | Genetic - basic beast. | - | ⏳ PENDING |
| **[Beast+]** | Genetic - enhanced beast. | - | ⏳ PENDING |
| **[Believer > Type]** | Psychology - belief system. | - | ⏳ PENDING |
| **[Belligerent]** | Psychology - must charge nearest enemy. | - | ⏳ PENDING |
| **[Berserker]** | Psychology - Fear token for bonuses. | - | ⏳ PENDING |
| **[Blackpowder]** | See [Fizzle], [Misfire]. | - | ⏳ PENDING |
| **[Blinders]** | Intrinsic - Scrum penalty, no Bow. | - | ⏳ PENDING |
| **[Blood-thirsty]** | See Resist > Blinding. | - | ⏳ PENDING |
| **[Bond > Target]** | Psychology - penalty when separated. | - | ⏳ PENDING |
| **[Braggart]** | May never Hide, penalizes Detect. | - | ⏳ PENDING |
| **[Carriage X]** | Intrinsic - asset on carriage. | - | ⏳ PENDING |
| **[Cautious]** | Psychology - avoid combat unless conditions. | - | ⏳ PENDING |
| **[Clumsy!]** | Attack Effect - extra AP costs. | - | ⏳ PENDING |
| **[Clumsy]** | Attack Effect - extra AP if Distracted. | - | ⏳ PENDING |
| **[Comrade]** | Psychology - must aid KO'd friends. | - | ⏳ PENDING |
| **[Configure X]** | Intrinsic - setup actions required. | - | ⏳ PENDING |
| **[Coward]** | Psychology - avoid enemy LOS. | - | ⏳ PENDING |
| **[Crewed X]** | Requires X models to operate. | - | ⏳ PENDING |
| **[Delusional]** | Psychology - extra AP unless Attentive. | - | ⏳ PENDING |
| **[Diminutive]** | STR -1, SIZ -1, +1 Detect. | - | ⏳ PENDING |
| **[Discard! > Type]** | Asset - discard for effects. | - | ⏳ PENDING |
| **[Discard!]** | Asset - single use. | - | ⏳ PENDING |
| **[Discard > Type]** | Asset - discard for effects. | - | ⏳ PENDING |
| **[Discard]** | Asset - limited uses. | - | ⏳ PENDING |
| **[Discard+ > Type]** | Asset - multi-use discard. | - | ⏳ PENDING |
| **[Discard+]** | Asset - degrading uses. | - | ⏳ PENDING |
| **[Discord X]** | Asset - magic interference. | - | ⏳ PENDING |
| **[Disfigured X]** | Reduces Presence trait. | - | ⏳ PENDING |
| **[Drone X > Actions]** | Intrinsic - remote controlled. | - | ⏳ PENDING |
| **[Emplace X > List]** | Asset - setup required. | - | ⏳ PENDING |
| **[Emplace X]** | Asset - emplace to use. | - | ⏳ PENDING |
| **[Entropy!!]** | Attack Effect - OR 2 MU penalty. | - | ⏳ PENDING |
| **[Entropy!]** | Attack Effect - OR 4 MU penalty. | - | ⏳ PENDING |
| **[Entropy]** | Attack Effect - OR 8 MU penalty. | - | ⏳ PENDING |
| **[Entropy+]** | Attack Effect - OR 16 MU penalty. | - | ⏳ PENDING |
| **[Exit]** | Removed from play, not Eliminated. | - | ⏳ PENDING |
| **[Feed X]** | Asset - ammo feed mechanics. | - | ⏳ PENDING |
| **[Fettered > Target]** | Intrinsic - must stay near target. | - | ⏳ PENDING |
| **[Flex]** | Asset - Stun on low Impact hits. | - | ⏳ PENDING |
| **[Fodder]** | Intrinsic - KO = Eliminated. | - | ⏳ PENDING |
| **[Fragile X]** | Asset - damage/destruction on fail. | - | ⏳ PENDING |
| **[Grenade X]** | Asset - thrown indirect. | - | ⏳ PENDING |
| **[Hafted]** | -1 Modifier die Defender Close Combat. | - | ⏳ PENDING |
| **[Hard-point X]** | Intrinsic - mounted items. | - | ⏳ PENDING |
| **[Hurried X]** | Delayed entry with Delay tokens. | - | ⏳ PENDING |
| **[Immobile]** | Intrinsic - no movement. | - | ⏳ PENDING |
| **[Impaired]** | Restricted actions and visibility. | - | ⏳ PENDING |
| **[Inept!!]** | Disallowed Pushing, Concentrate, Rally, Reacts. | - | ⏳ PENDING |
| **[Inept!]** | Disallowed Pushing, Concentrate, Rally, Bonus. | - | ⏳ PENDING |
| **[Inept]** | Disallowed Pushing, Concentrate, Rally. | - | ⏳ PENDING |
| **[Jam X]** | Asset - jamming mechanics. | - | ⏳ PENDING |
| **[Jitter!]** | Attack Effect - extra AP if ROF > STR-1. | - | ⏳ PENDING |
| **[Jitter]** | Attack Effect - extra AP if ROF > STR. | - | ⏳ PENDING |
| **[Jitter+]** | Attack Effect - extra AP if ROF > STR+1. | - | ⏳ PENDING |
| **[Junk]** | Intrinsic - jam/break on no successes. | - | ⏳ PENDING |
| **[Limbered]** | Deploy 4 MU further, immobile. | - | ⏳ PENDING |
| **[Lumbering]** | Intrinsic - Base die penalties when flanked. | - | ⏳ PENDING |
| **[Mail]** | Asset - reduced AR vs Bows/Hafted. | - | ⏳ PENDING |
| **[Mindless!]** | Mind - Puppet, coordinator required. | - | ⏳ PENDING |
| **[Mindless]** | Mind - Puppet, coordinator required. | - | ⏳ PENDING |
| **[Mindless+]** | Mind - Puppet, extended cohesion. | - | ⏳ PENDING |
| **[Misfire]** | Attack Effect - jam on no successes. | - | ⏳ PENDING |
| **[Mounted X]** | Asset - emplaced on fixture. | - | ⏳ PENDING |
| **[Nervous]** | Psychology - Fear on first combat. | - | ⏳ PENDING |
| **[Outnumber]** | See Outnumber situational modifier. | - | ⏳ PENDING |
| **[Overwatch]** | See Wait and React rules. | - | ⏳ PENDING |
| **[Pilot X]** | Intrinsic - controls vehicle/drone. | - | ⏳ PENDING |
| **[Plasma]** | Attack Effect - special damage type. | - | ⏳ PENDING |
| **[Power X]** | Asset - energy capacity. | - | ⏳ PENDING |
| **[Presence X]** | Leadership aura effects. | - | ⏳ PENDING |
| **[Protective]** | Critical hits become normal hits. | - | ⏳ PENDING |
| **[Psychic X]** | Magic - psychic abilities. | - | ⏳ PENDING |
| **[Recoil X]** | Attack Effect - push back attacker. | - | ⏳ PENDING |
| **[Reveal]** | Remove Hidden status on attack. | - | ⏳ PENDING |
| **[Scatter X]** | Attack Effect - indirect scatter. | - | ⏳ PENDING |
| **[Scrambling X]** | Attack Effect - electronic warfare. | - | ⏳ PENDING |
| **[Sensor X]** | Intrinsic - detection range. | - | ⏳ PENDING |
| **[Shield X]** | See Shield armor types. | - | ⏳ PENDING |
| **[Siege]** | Attack Effect - vs structures. | - | ⏳ PENDING |
| **[Silent]** | No sound, +1 Hidden. | - | ⏳ PENDING |
| **[Slow]** | -1 MOV, -1 Initiative. | - | ⏳ PENDING |
| **[Smoke X]** | Attack Effect - smoke cloud. | - | ⏳ PENDING |
| **[Solitary]** | +1 Wild die when alone. | - | ⏳ PENDING |
| **[Sprint X]** | +X MOV for charge/jump. | - | ⏳ PENDING |
| **[Steady]** | No penalty for moving and shooting. | - | ⏳ PENDING |
| **[Stub]** | Short range, no Overreach. | - | ⏳ PENDING |
| **[Subtle]** | Hard to detect, +1 Hidden. | - | ⏳ PENDING |
| **[Suppress X]** | Attack Effect - suppression tokens. | - | ⏳ PENDING |
| **[Swarm]** | Multiple models as one. | - | ⏳ PENDING |
| **[Tethered X]** | Connected to source/point. | - | ⏳ PENDING |
| **[Toggle > Form]** | Transform between forms. | - | ⏳ PENDING |
| **[Tracer]** | Attack reveals position. | - | ⏳ PENDING |
| **[Unnatural]** | Immune to Psychology, special rules. | - | ⏳ PENDING |
| **[Vehicle X]** | Intrinsic - vehicle rules. | - | ⏳ PENDING |
| **[Volatile X]** | Explodes on destruction. | - | ⏳ PENDING |
| **[Waterproof]** | Immune to water terrain effects. | - | ⏳ PENDING |
| **[Web X]** | Attack Effect - entangle target. | - | ⏳ PENDING |

---

## Existing Test Files

The following test files already exist and may contain related tests:

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/mest-tactics/traits/combat-traits.test.ts` | Combat trait tests (39 tests passing) | ✅ 16 QSR traits covered |
| `src/lib/mest-tactics/traits/item-traits.test.ts` | Item trait tests | ⏳ PENDING - needs creation |
| `src/lib/mest-tactics/traits/trait-parser.test.ts` | Trait parser tests | ✅ Infrastructure |
| `src/lib/mest-tactics/traits/Trait.test.ts` | Basic Trait class tests | ✅ Infrastructure |
| `src/lib/mest-tactics/traits/trait-logic-registry.test.ts` | Trait logic registry | ✅ Infrastructure |

---

## Notes

1. **QSR Traits** are the core traits needed for basic gameplay (Bronze Age to Renaissance).
2. **Advanced Traits** include psychology, magic, technology, and special rules not in QSR.
3. Some traits have multiple levels (X = 1, 2, 3, etc.) - tests should cover each level.
4. Item traits (in brackets like `[1H]`) are typically on weapons/equipment.
5. Intrinsic traits are inherent to the model/character.
6. Attack Effect traits trigger on successful hits.
7. Psychology traits affect behavior and morale.
