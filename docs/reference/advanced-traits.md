# Advanced Traits Cross-Reference

**Generated:** February 26, 2026
**Source:** `src/data/trait_descriptions.json` cross-referenced with `src/guides/docs/rules-advanced-*.md`

---

## Summary

| Status | Count | Description |
|--------|-------|-------------|
| ✅ **Documented** | 45 | Traits covered in advanced rules documentation |
| ⚠️ **Partial** | 20 | Traits mentioned but need more rules context |
| ❌ **DEFERRED** | 25 | Traits needing additional context from user |

---

## ✅ Documented Traits (Covered in Advanced Rules)

### ROF & Suppression Traits
| Trait | Source File | Related Docs |
|-------|-------------|--------------|
| **ROF X** | MEST.Tactics.Advanced-ROF.txt | rules-advanced-rof.md |
| **[Feed X]** | MEST.Tactics.Advanced-ROF.txt | rules-advanced-rof.md |
| **[Jam X]** | MEST.Tactics.Advanced-ROF.txt | rules-advanced-rof.md |
| **[Jitter]**, **[Jitter!]**, **[Jitter+]** | MEST.Tactics.Advanced-ROF.txt | rules-advanced-rof.md |
| **Suppress X** | MEST.Tactics.Advanced-Suppression.txt | rules-advanced-suppression.md |

### Fire & Effects Traits
| Trait | Source File | Related Docs |
|-------|-------------|--------------|
| **Fire** | MEST.Tactics.Advanced-Fire.txt | rules-advanced-fire.md |
| **Burn X** | MEST.Tactics.Advanced-Effects.txt | rules-advanced-effects.md |
| **Burned** | MEST.Tactics.Advanced-Fire.txt | rules-advanced-fire.md, rules-advanced-effects.md |
| **Blast X** | MEST.Tactics.Advanced-Effects.txt | rules-advanced-effects.md |
| **Frag X** | MEST.Tactics.Advanced-Effects.txt | rules-advanced-effects.md |

### Gas & Environment Traits
| Trait | Source File | Related Docs |
|-------|-------------|--------------|
| **Fume X** | MEST.Tactics.Advanced-Gas.Fume.Puffs.txt | rules-advanced-gas-fume-puffs.md |
| **Gas:Type** | MEST.Tactics.Advanced-Gas.Fume.Puffs.txt | rules-advanced-gas-fume-puffs.md |
| **Gas:Steam**, **Gas:Smoke**, **Gas:Poison** | MEST.Tactics.Advanced-Gas.Fume.Puffs.txt | rules-advanced-gas-fume-puffs.md |

### Hindrance Token Traits
| Trait | Source File | Related Docs |
|-------|-------------|--------------|
| **Acid X** | MEST.Tactics.Advanced-Effects.txt | rules-advanced-effects.md |
| **Blinding X** | MEST.Tactics.Advanced-Effects.txt | rules-advanced-effects.md |
| **Confused** | MEST.Tactics.Advanced-Effects.txt | rules-advanced-effects.md |
| **Entangled** | MEST.Tactics.Advanced-Effects.txt | rules-advanced-effects.md |
| **Held** | MEST.Tactics.Advanced-Effects.txt | rules-advanced-effects.md |
| **Poisoned** | MEST.Tactics.Advanced-Effects.txt | rules-advanced-effects.md |
| **Transfixed** | MEST.Tactics.Advanced-Effects.txt | rules-advanced-effects.md |

### Group Actions Traits
| Trait | Source File | Related Docs |
|-------|-------------|--------------|
| **Leadership X** | MEST.Tactics.Advanced-Go.txt | rules-advanced-go.md |
| **Officer** | MEST.Tactics.Advanced-Go.txt | rules-advanced-go.md |
| **Pack-mentality** | MEST.Tactics.Advanced-Go.txt | rules-advanced-go.md |
| **Pathfinder** | MEST.Tactics.Advanced-Go.txt | rules-advanced-go.md |
| **Unit** | MEST.Tactics.Advanced-Go.txt | rules-advanced-go.md |
| **[Cautious]** | MEST.Tactics.Advanced-Go.txt | rules-advanced-go.md |
| **[Coward]** | MEST.Tactics.Advanced-Go.txt | rules-advanced-go.md |
| **[Mindless]**, **[Mindless!]**, **[Mindless+]** | MEST.Tactics.Advanced-Go.txt | rules-advanced-go.md |
| **[Stubborn]** | MEST.Tactics.Advanced-Go.txt | rules-advanced-go.md |
| **[Undisciplined]** | MEST.Tactics.Advanced-Go.txt | rules-advanced-go.md |

### Champions & LoA Traits
| Trait | Source File | Related Docs |
|-------|-------------|--------------|
| **Reputation X** | MEST.Tactics.Advanced-Champions.txt | rules-advanced-champions.md |
| **[Beast]**, **[Beast!]**, **[Beast+]** | MEST.Tactics.Advanced-Champions.txt | rules-advanced-champions.md |
| **[Primitive]** | MEST.Tactics.Advanced-Champions.txt | rules-advanced-champions.md |

### Firelane Traits
| Trait | Source File | Related Docs |
|-------|-------------|--------------|
| **Fire-lane** | MEST.Tactics.Advanced-Firelane.txt | rules-advanced-firelane.md |
| **[Emplace X]**, **[Emplace X > List]** | MEST.Tactics.Advanced-Firelane.txt | rules-advanced-firelane.md |
| **[Crewed X]** | MEST.Tactics.Advanced-Firelane.txt | rules-advanced-firelane.md |

### Lighting Traits
| Trait | Source File | Related Docs |
|-------|-------------|--------------|
| **Light X** | MEST.Tactics.Advanced-Lighting.txt | rules-advanced-lighting.md |
| **Light X (Flicker)** | MEST.Tactics.Advanced-Lighting.txt | rules-advanced-lighting.md |

### Webbing Traits
| Trait | Source File | Related Docs |
|-------|-------------|--------------|
| **Webcaster X** | MEST.Tactics.Advanced-Webbing.txt | rules-advanced-webbing.md |
| **Webcrawler** | MEST.Tactics.Advanced-Webbing.txt | rules-advanced-webbing.md |

### Terrain Traits
| Trait | Source File | Related Docs |
|-------|-------------|--------------|
| **Surefooted X** | MEST.Tactics.Advanced-Terrain.txt | rules-advanced-terrain.md |
| **[Limbered]** | MEST.Tactics.Advanced-Terrain.txt | rules-advanced-terrain.md |

---

## ⚠️ Partial Documentation (Need More Rules Context)

These traits are mentioned in trait_descriptions.json but the advanced rules documents don't provide complete implementation details:

| Trait | Issue |
|-------|-------|
| **[Arc X]** | References [Scatter] and Indirect Attack rules not fully documented |
| **[Backblast X]** | Needs Burned token placement rules clarification |
| **[Carriage X]** | Complex Dislodging rules need full documentation |
| **[Configure X]** | References [Emplace] interaction needs clarification |
| **[Discard > Type]**, **[Discard! > Type]**, **[Discard+ > Type]** | Multiple variants need implementation guidance |
| **[Discord X]** | Magic trait interaction needs rules context |
| **[Drone X > Actions]** | Controller AP spending rules need clarification |
| **[Entropy]**, **[Entropy!]**, **[Entropy!!]**, **[Entropy+]** | OR attenuation rules need full documentation |
| **[Exit]** | Removal from play rules need clarification |
| **[Fettered > Target]** | Cohesion enforcement rules need clarification |
| **[Flex]** | Suit trait interaction with Stun needs clarification |
| **[Fodder]** | Bottle Test interaction needs rules context |
| **[Fragile X]** | Damage state tracking needs implementation guidance |
| **[Grenade X]** | Indirect Attack interaction needs clarification |
| **[Hard-point X]** | Mounted Item destruction rules need clarification |
| **[Hurried X]** | Delayed entry rules need clarification |
| **[Immobile]** | Combat penalty application needs clarification |
| **[Impaired]** | Multiple restrictions need implementation guidance |
| **[Inept]**, **[Inept!]**, **[Inept!!]** | Progressive disability levels need clarification |
| **[Jam X]** | ROF interaction already documented but needs implementation |

---

## ❌ DEFERRED Traits (Need User Context)

These traits require additional context from the user to implement properly. They reference game mechanics, keywords, or systems not covered in the provided Advanced rules documents:

### Magic & Arcanics Traits
| Trait | Reason for Deferral |
|-------|---------------------|
| **[Discord X]** | Magic system rules not provided |
| **Anti-magic X** | Magic keyword system not documented |
| **Aura X > List** | Magic AoE rules need clarification |
| **Battery X:Type > List** | Electronic/Magic Item interaction needs context |
| **Codex X** | Magic spell system not documented |
| **Counter-spell!** | Magic reaction system not documented |
| **Dispell** | Magic card system not documented |
| **Etheric X** | Etheric keyword system not documented |
| **Magic Link** | Magic system not documented |
| **Manapool X** | Mana system rules not provided |
| **Psychic X** | Psionic system rules not provided |
| **Sorcerer X** | Magic trait system not documented |
| **Spell X** | Spell system not documented |
| **Summoner** | Summoning system not documented |
| **[Summon-bound > Classifier]** | Summoning rules not documented |
| **[Virtual]** | Magic sigil system not documented |
| **[Zucked X]** | Mana/Etheric/Magic/Arcane interaction needs context |

### Technology & Equipment Traits
| Trait | Reason for Deferral |
|-------|---------------------|
| **Analytics** | Test resolution system needs clarification |
| **Anti-electric X** | Electric keyword system not documented |
| **Anti-psionic X** | Psionic keyword system not documented |
| **[Automaton]**, **[Automaton!]**, **[Automaton+]** | Automaton rules need full documentation |
| **[Toggle > Form]**, **[Toggle]** | Transformation system not documented |
| **[Vehicle X]** | Vehicle piloting rules need clarification |
| **Ammo X** | Ammo tracking system needs clarification |
| **[Requires > Type]** | Item type system needs context |

### Psychology & Behavior Traits
| Trait | Reason for Deferral |
|-------|---------------------|
| **[Addicted X > Type]** | Addiction system rules not provided |
| **[Believer > Type]**, **Believer X > Belief** | Belief system not documented |
| **[Belligerent]** | Compulsory action rules need clarification |
| **[Berserker]** | Fear token interaction needs rules context |
| **[Blood-thirsty]** | Resist > Blinding reference not documented |
| **[Bond > Target]** | Cohesion penalty rules need clarification |
| **[Braggart]** | Hide action interaction needs clarification |
| **[Comrade]** | Revive action interaction needs clarification |
| **[Delusional]** | Action cost modification needs clarification |
| **[Nervous X]** | Morale Test penalty needs context |
| **[Paranoid X]** | Rally interaction needs clarification |
| **[Phobia X > Trait]** | Fear/Coward interaction needs clarification |
| **[Ravenous]** | Psychology/Intrinsic dual nature needs clarification |
| **[Reckless]** | Scrum penalty application needs clarification |
| **[Selfless]**, **[Selfless > Target]** | Damage redirection needs clarification |
| **[Treacherous]** | Control transfer rules need clarification |
| **[Triggered]** | Transfixed token application needs clarification |
| **[Vow]** | Elimination prevention needs clarification |
| **[Weak-minded X]** | Distracted/Nervous interaction needs clarification |
| **[Weakness X > Trait]** | Keyword/Trait/Terrain interaction needs context |

### Movement & Positioning Traits
| Trait | Reason for Deferral |
|-------|---------------------|
| **Amorphous X** | Psychic/Genetic dual nature, porous terrain rules |
| **Amphibious** | Water terrain rules need full documentation |
| **Burrow X** | Underground status system not documented |
| **Evasive X** | Reposition rules need clarification |
| **Flight X** | Flying status rules not documented |
| **Glide X** | Flying status rules not documented |
| **Leap X** | Agility interaction needs clarification |
| **Sprint X** | Movement allowance modification needs context |
| **[Tethered]** | Action assignment system needs clarification |
| **[Traversal]**, **[Traversal!]**, **[Traversal+]** | Front-arc targeting rules need clarification |
| **[Winged]** | Flight/Glide interaction, Wind rules not documented |

### Combat & Attack Traits
| Trait | Reason for Deferral |
|-------|---------------------|
| **[Arc X]** | Indirect Attack rules need full documentation |
| **[Awkward]** | Already implemented but needs verification |
| **[Clumsy]**, **[Clumsy!]** | AP cost modification needs clarification |
| **[Misfire]** | Jammed! token system needs clarification |
| **[Orbs X > Traits]** | Scramble! interaction needs clarification |
| **[Recoil X]** | STR comparison rules need clarification |
| **[Scatter X]** | Scatter rules need full documentation |
| **[Solo > List]** | Free/Attentive trait activation needs context |
| **[Stay > List]** | Base-contact trait activation needs clarification |
| **Boxer** | Concentrate/Scrum interaction needs clarification |
| **Brace** | Consecutive attack rules need clarification |

### Status & Condition Traits
| Trait | Reason for Deferral |
|-------|---------------------|
| **[Safety]** | Disordered/Panicked status interaction needs clarification |
| **[Stun-only]** | Stun damage conversion needs clarification |
| **[Stupid]** | AP reduction rules need clarification |
| **[Slow]**, **[Slow!]** | AP limitation rules need clarification |
| **[Solitary]** | Morale/Initiative/Bottle interaction needs clarification |
| **[Re-animated]** | Zombie state progression needs clarification |
| **[Reveal]** | Punctuated Noise rules not documented |
| **[Noise X]** | Punctuated Noise rules not documented |
| **[Signature X]** | Hidden status interaction needs clarification |
| **[Vitriol X]** | Shaken status system not documented |

### Special Traits
| Trait | Reason for Deferral |
|-------|---------------------|
| **Augment X > List** | Multiplier system needs clarification |
| **Beacon X > Target** | Beacon targeting system needs clarification |
| **Bonus:Melee X > Action**, **Bonus:Range X > Action** | Bonus Action sets need definition |
| **Bulletproof** | Concentrate/Visibility interaction needs clarification |
| **Bombproof X** | Burn/Blast/Frag reduction needs clarification |
| **[Diminutive]** | Attribute modification needs clarification |
| **[Disfigured X]** | Presence trait interaction needs clarification |
| **[Fodder]** | Bottle Test automatic fail needs clarification |
| **[Prissy]** | Agility restriction needs clarification |
| **[Poor Shot X]** | Range Attack restriction needs clarification |
| **[Triggered]** | Transfixed token application needs clarification |

---

## Next Steps

1. **User to provide context** for DEFERRED traits in the following categories:
   - Magic/Arcanics system rules
   - Psionic/Etheric system rules
   - Vehicle/Drone/Automaton rules
   - Punctuated Noise rules
   - Flying status and Wind rules
   - Underground/Burrowing rules
   - Summoning rules
   - Belief/Psychology system rules

2. **Create implementation stubs** for Partial traits with TODO comments

3. **Prioritize trait implementation** based on:
   - Frequency of use in data files
   - Dependency on other traits
   - QSR vs Advanced classification

---

**Files Referenced:**
- `src/data/trait_descriptions.json` (1206 lines, 80+ traits)
- `src/guides/docs/rules-advanced-*.md` (14 files)
- `docs/MEST.Tactics.Advanced-*.txt` (14 source files)
