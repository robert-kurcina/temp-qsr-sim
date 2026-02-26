---
title: Traits List
description: A comprehensive compendium of all traits in MEST Tactics from QSR.txt Reference section.
priority: 2
---

# Traits List

This module provides a definitive list and description for all traits available in MEST Tactics per the QSR Reference section (lines 1296-1395).

## Trait Keywords

These keywords classify traits and determine how they interact with other rules.

| Keyword | Description |
|---------|-------------|
| **Asset** | Item trait. Beneficial trait assigned to weapons, armor, or equipment. |
| **Attack Effect** | Assigned to a weapon. Trait that triggers on attack. |
| **Genetic** | Inherent biological trait. Often paired with Skill or Movement. |
| **Intrinsic** | Built-in trait that cannot be removed. |
| **Leader** | Trait that affects Friendly models within Visibility or Cohesion. |
| **Movement** | Provides benefits for Agility or Movement actions. |
| **Natural Weapon** | Melee weapon used for Close Combat Hit and Damage Tests. Not penalized for multiple attacks. Cannot use Overreach. Default: Acc +0, Impact +0, Damage STR. |
| **Psychology** | Mental/emotional trait. Affects Morale Tests and behavior. |
| **Silent** | Keyword for stealth-related traits. |
| **Skill** | Learned ability that can be improved with levels (X). |

---

## Disability Traits (Penalties)

### [1H]
**Asset.** One-handed weapon.
- Used with a **Concentrate action**: requires **two hands** instead of one.
- May be used with **one less hand**, but causes **-1 Base die** penalty for:
  - Any **Fiddle Tests**
  - The **very next Test** performed when interrupted by a **React**

### [2H]
**Asset.** Two-handed weapon.
- When used with **two hands**: **disallowed to use Overreach**.
- May be used with **one less hand**, but causes **-1 Base die** penalty for:
  - Any **Fiddle Tests**
  - The **very next Test** performed when interrupted by a **React**

### [Awkward]
**Attack Effect.**
- Costs **+1 AP** to perform **Attacks** while in **base-contact** with any Opposing model.
- When an Opposing model (if no smaller than **SIZ - 3**) receives the **Charge bonus** against this model, this model **acquires a Delay token** before resolving the attack.

### [Blinders]
**Intrinsic.**
- **-1m** in a **Scrum**.
- May **not perform Bonus Actions** unless **Attentive**.
- **Ranged Attacks with Bow weapons**: **disallowed**.
- **Thrown weapons**: **-1m** penalty.

### [Discard]
**Asset.** Limited use.
- **[Discard!]**: Do not use again after first use.
- **[Discard+]**: Roll a die after each use. If fail, the next use is the last. May not use more than **3 times total**.
- **Else** (plain Discard): After first use, roll a die. If fail, may not use again. Otherwise, may use **once more**.

### [Discard!]
**Asset.** Single use. Remove item after use.

### [Discard+]
**Asset.** Limited use with die roll. May not use more than **3 times total**.

### [Hafted]
**Asset.**
- **-1m** for **Defender Close Combat Hit Tests**.

### [Laden X]
**Asset.** Compare total **1 + Laden X** from all equipped items to character's **Physicality** (higher of **STR** or **SIZ**).

Each point above Physicality is a **burden**. For each burden:
- **Reduce MOV by 1** and recalculate **Agility** accordingly.
- **Reduce REF by 1** and **CCA by 1** unless **Attentive Ordered**.
- **Reduce by 1** any trait with the **Movement** keyword.

### [Lumbering]
**Intrinsic.**
- For **Situational Test Modifiers**, when **Flanked**, **Cornered**, or **Confined**: penalty is **-1b** each instead of **-1m** each.

### [Reload X]
**Asset.** See [1H] for hand penalty rules.
- After performing an action or Test with this weapon and it is available for use: mark with **Out-of-Ammo!** marker.
- Remains **unusable** until character performs **X Fiddle actions** for **1 AP each**.

### [Stub]
**Attack Effect.**
- May **not use Overreach** when attacking.
- **-1m Close Combat Hit Tests** unless in **base-contact** with **only** Opposing models using weapons with **[Stub]** for Close Combat.
- **Passive characters** in base-contact are **not considered Engaged** unless they also have **[Stub]**.

---

## Ability Traits (Beneficial)

### Acrobatic X
**Genetic. Skill. Movement.**
- **+X Wild dice** for **Defender Close Combat Tests**.

### Armor X
**Intrinsic.**
- Reduce any **Wound damage** received by **X** (also known as **+X Armor Rating** or **+X AR**).
- Weapon's **Impact [I]** reduces total **AR** by an equivalent amount.
- If attacked by a **Concentrated Attack**: reduce **3 AR** from **each Item Type** with the **Armor** trait.

### Archery
**Skill.**
- Ignore the **[Reload]** trait on **Bow weapons**.
- Does **not** provide the **Shoot** trait.

### Bash
**Asset.**
- May use as an **Improvised Melee weapon**.
- **+1 cascade** for **Bonus Actions** after passing **Attacker Close Combat Test** if:
  - Attack qualifies for **Charge bonus** (see [[rules-situational-modifiers|Rules: Situational Modifiers]])
  - In **base-contact** with the target

**Note:** "Charging" = qualifying for the Charge bonus Situational Test Modifier, NOT the Charge trait.

### Brawl X
**Skill.**
- **+X cascades** whenever performing **Bonus Actions** for Close Combat.
- If Opposing model has **Brawl**, reduce **both levels** by the **lower amount**.
- If **Attentive** and **Engaged**: may **acquire a Delay token** to perform **Bonus Actions** despite **failing** the **Attacker Close Combat Test** (do this after target's **Passive Player Options**).

### Brawn X
**Genetic. Psychology. Skill.**
- **+X STR** except for **Attacker Close Combat Damage Tests**.

### Charge
**Attack Effect.** (Note: This is a trait assigned to weapons/items, NOT the same as the Charge bonus Situational Test Modifier)

**Effect:**
- When **Attentive**: **+1 Wild die Attacker Damage Test** and **+1 Impact** if the attack qualifies for the **Charge bonus** (Situational Test Modifier).

**Important Distinction:**
- **Charge bonus** = Situational Test Modifier (+1m to Attacker Hit Test) earned by moving and attacking
- **Charge trait** = Weapon/item trait that provides additional Damage Test benefits when Charge bonus applies

**Charge Bonus Qualification** (see [[rules-situational-modifiers|Rules: Situational Modifiers]]):
- Move into **base-contact** with target
- Move over **Clear terrain**
- Start from **Free** position
- Start at least **base-diameter away** from target before becoming Engaged
- **Attentive** status required for Charge trait benefits

### Cleave X
**Attack Effect.**
- If target of **Attacker Damage Test** is **KO'd**: it is instead **Eliminated**.
- If **X is 2 or more**: presume target first received **extra X - 1 Wounds**.

### Conceal
**Asset.**
- **One** of this Item may always be assigned to a model **despite its sculpt**.

### Counter-strike!
**Skill.**
- May perform a **Close Combat Attack** as a **React** against an Opponent who makes a Close Combat Attack and **misses**.
- Costs **1 AP**.

### Coverage X
**Asset. Skill.**
- For each **X**: **ignore one Engaged Opposing model** in a **Scrum**.
- When **Attentive**: allow up to **X Friendly models** in **base-contact** and **Engaged** to the same Opposing model to **benefit from this Item** this Turn.

### Deflect X
**Asset.**
- **+X Modifier dice** for **Defender Hit Tests**.
- **Disregard** for **Defender Range Hit Test** when **Engaged**.

> **Note:** This trait has been modified for these QSR rules.

### Detect X
**Genetic. Skill.**
- **+X Base dice** for **Attacker Detect Tests**.
- **Maximum OR Multiple** for Detect Tests **increased by X**.

### Discrete
**Asset.**
- **Any number** of this Item may always be assigned to a model **despite its sculpt**.

### Evasive X
**Genetic. Skill. Movement.**
- **+X Modifier dice per OR Multiple** for **Defender Range Combat Hit Tests**.
- **Once per Turn**: if **Attentive Free** after being targeted for a **Range Attack**, may **reposition X × 1"** and allow use of any **Agility** for any or all of that distance.
- If combined with **repositioning** from being **Revealed**: **Agility** can be used for **just one or the other**.
- If attack has option to use **ROF**: place those markers **afterwards**.

### Fight X
**Skill.**
- **Reduces up to X penalty Modifier dice** for **Close Combat Hit Tests**.
- When **Attentive**: for each level of **Fight higher than the Opposing character**, allow **one additional Bonus Action** for the **Attack action**.
- These additional Bonus Actions may **not** have already been performed during this Action.

### Grit X
**Psychology. Skill.**
- Does **not perform Morale Test** when a Friendly model is **KO'd** or **Eliminated** unless that model had **higher POW**.
- **Reduce the first Fear token** received when **Attentive**.
- When receiving **Fear tokens**: optionally **convert up to X Fear tokens into Delay tokens** instead.

### Impale
**Attack Effect.**
- **Distracted targets**: **-1b Defender Damage Test** plus **+1 per 3 Impact remaining**.
- Use the **lowest amount of Impact remaining** for Defender if it had multiple types of Armor.

### Insane
**Psychology.**
- Unless has **one or more Hindrance tokens**: **not affected** by any trait with the **Psychology** keyword and does **not perform Morale Tests**.
- **Not affected** by **Hindrance penalties** for Morale Tests.

> **Note:** This trait has been modified for these QSR rules.

### Knife-fighter X
**Skill.**
- When **Attentive** and in **base-contact** while using a weapon with **[Stub]** trait: **+X Base dice** and **+X Impact** for **Close Combat Tests**.

### Leadership X
**Psychology. Skill. Leader.**
- **Friendly models within Visibility**: **+X Base dice** for all **Morale Tests**.
- Models may **not** receive this bonus from **more than one character** with **Leadership** trait per Test.

> **Note:** This trait has been modified for these QSR rules.

### Leap X
**Genetic. Movement.**
- **+X" Agility**.
- Must be used at **either the start or end** of a **Movement action** or **reposition**.

### Parry X
**Intrinsic.**
- **+X Modifier dice** for **Defender Close Combat Tests**.

### Perimeter
**Intrinsic.**
- While **Attentive**: **Opposing models** may only make **base-contact** if they are **Attentive** and use **Agility**.
- **+1m Defending Close Combat** while **not in base-contact** or when Opposing model **moves into base-contact** for the current Initiative.

### Protective X
**Intrinsic.**
- **Discard X Delay tokens** received as **Stun damage** from an attack.
- Must be **Attentive** if targeted by a **Concentrated Close Combat Attack**.
- Must be **in Cover** if targeted by a **Concentrated Range Combat Attack**.

### Reach X
**Intrinsic.**
- **Melee Range** extended up to **X × 1 MU** further than default (typically measured from base).
- When **Attentive Ordered**: Melee Range may **extend through** the base of a **Friendly Attentive Ordered model**, or a **Distracted** or **Disordered Opposing model**.

### Shoot X
**Skill.**
- **Reduce up to X penalty Modifier dice** for **Attacker Range Combat Hit Tests**.
- **Increase Maximum OR Multiple by X**.

### Sneaky X
**Psychology. Skill.**
- If **Attentive**: at **end of Initiative**, **automatically become Hidden** at no cost if **behind Cover** or when **not in LOS**.
- **+X Modifier dice** when benefiting from **Suddenness** Situational Test Modifier.
- Optionally **begins any Mission as Hidden** if **behind Cover**.

### Sprint X
**Genetic. Movement.**
- **+X × 2"** for **Movement Allowance** while moving in a **relatively straight line**.
- If also **Attentive Free**: **+X × 4"** instead.

### Stun X
**Attack Effect.**
- If Active character **passes Attacker Close Combat Damage Test**, or if **adding X causes the Test to pass**: there may be a **Stun effect**.
- **Stun Test**: Add **X** to successes scored by Active character, subtract target's **Durability** (higher of **SIZ** or **FOR**). Note cascades.
- Target **acquires a Delay token** as **Stun damage** if Stun Test passes, and **one more for every 3 additional cascades**.

### Surefooted X
**Genetic. Movement.**
- **Upgrade Terrain effects** on movement, and for **Bonus Actions** and **Situational Test Modifiers**:
  - **X = 1**: Rough → Clear
  - **X = 2**: Difficult → Rough
  - **X = 3**: Difficult → Clear

### Tactics X
**Psychology. Skill. Leader.**
- **+X Base dice** when **designated for Initiative Tests**.
- **Avoid X additional Turns** requiring **Situational Awareness**, as **Designated Leader** and as **Assembly member**.

### Throwable
**Asset.**
- See **[Discard+]**.
- Use as **Thrown weapon** for **Ranged Attacks**.
- Do **not receive** any **Accuracy [Acc] bonus**.

### Unarmed
**Natural Weapon. Psychology.**
- See **[2H]** for hand penalty rules.
- Character has **no weapons in hand** and has **no immediately useful Natural weapons** assigned.
- **-1m Close Combat Hit Test**, at **STR - 1m** for **Close Combat Damage Test**.
- **Counts as having [Stub]**.
- May always **acquire and use other weapons** during game-play, but then acquire **[Discard]** when using them and **failing** a Close Combat attack.

---

## Quick Reference by Category

### Hand Requirements
| Trait | Hand Rule |
|-------|-----------|
| **[1H]** | 1 hand required; Concentrate needs 2 hands |
| **[2H]** | 2 hands required; cannot Overreach with 2 hands |
| **[Crewed X]** | Requires X models, each with 1H |

### Movement & Agility
| Trait | Effect |
|-------|--------|
| **Acrobatic X** | +X Wild dice Defender Close Combat |
| **Evasive X** | +X Modifier dice per ORM; reposition X×1" |
| **Leap X** | +X" Agility |
| **Movement** | Keyword for Agility/Movement benefits |
| **Sprint X** | +X×2" (or +X×4" if Attentive Free) |
| **Surefooted X** | Upgrade terrain (Rough→Clear, etc.) |

### Combat Bonuses
| Trait | Effect |
|-------|--------|
| **Brawl X** | +X cascades for Bonus Actions |
| **Brawn X** | +X STR (except CC Damage) |
| **Charge** | +1 Wild die Damage +1 Impact (with Charge bonus) |
| **Fight X** | Reduce X penalty dice; extra Bonus Actions |
| **Knife-fighter X** | +X Base dice +X Impact with [Stub] weapons |
| **Shoot X** | Reduce X penalty dice; +X Max ORM |

### Defense & Protection
| Trait | Effect |
|-------|--------|
| **Armor X** | Reduce Wound damage by X (AR X) |
| **Coverage X** | Ignore Engaged models in Scrum |
| **Deflect X** | +X Modifier dice Defender Hit Tests |
| **Parry X** | +X Modifier dice Defender Close Combat |
| **Perimeter** | +1m when not in base-contact; blocks base-contact |
| **Protective X** | Discard X Delay from Stun |
| **Reach X** | +X×1 MU Melee Range |

### Psychology & Morale
| Trait | Effect |
|-------|--------|
| **Grit X** | Morale immunity; Fear→Delay conversion |
| **Insane** | Immune to Psychology traits and Morale Tests |
| **Leadership X** | +X Base dice Morale for Friendly models in Visibility |
| **Sneaky X** | Auto-Hide; +X Suddenness; start Hidden |
| **Tactics X** | +X Base dice Initiative; avoid Situational Awareness |

### Special Attacks
| Trait | Effect |
|-------|--------|
| **Bash** | Improvised Melee; +1 cascade with Charge |
| **Cleave X** | KO'd → Eliminated; extra X-1 Wounds |
| **Impale** | Distracted: -1b Damage +1 per 3 Impact |
| **Stun X** | Stun Test → Delay tokens |

### Equipment & Items
| Trait | Effect |
|-------|--------|
| **Conceal** | 1 item ignores sculpt |
| **Discrete** | Unlimited items ignore sculpt |
| **[Discard]** / **[Discard!]** / **[Discard+]** | Limited use mechanics |
| **[Hafted]** | -1m Defender Close Combat Hit |
| **[Laden X]** | Burden penalties (MOV, REF, CCA reduction) |
| **[Reload X]** | X Fiddle actions to reload |
| **[Stub]** | -1m CC Hit; no Overreach; special Engaged rules |
| **Throwable** | Use as Thrown weapon; [Discard+]; no Acc bonus |
| **Unarmed** | Natural Weapon; -1m Hit; STR-1m Damage; [Stub] |

### Keywords Summary
| Keyword | Purpose |
|---------|---------|
| **Asset** | Item trait (beneficial) |
| **Attack Effect** | Weapon attack trigger |
| **Genetic** | Biological/inherent |
| **Intrinsic** | Built-in, unremovable |
| **Leader** | Affects Friendly models |
| **Movement** | Agility/Movement benefits |
| **Natural Weapon** | Innate melee weapon |
| **Psychology** | Mental/emotional effects |
| **Silent** | Stealth-related |
| **Skill** | Learned ability (level-based) |

---

## QSR Source Reference

**Source:** `MEST.Tactics.QSR.txt` lines **1296-1395** (Traits List Reference section)

**Note:** Traits marked as "modified for these QSR rules" in the source:
- **Deflect X**
- **Insane**
- **Leadership X**
