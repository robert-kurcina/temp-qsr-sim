---
dependencies:
  - rule: rules-traits.md
    priority: 2
    status: DONE
  - rule: rules-tests-and-checks.md
    priority: 2
    status: DONE
  - rule: rules-situational-modifiers.md
    priority: 3
    status: DONE
  - rule: rules-combat.md
    priority: 5
    status: DONE
  - rule: rules-damage-and-morale.md
    priority: 6
    status: DONE
  - rule: rules-movement-and-terrain.md
    priority: 3
    status: DONE
---
# Actions

## Individual Actions

Actions are classified as Simple, Special, Complex and their frequency of use follows that order. When learning these rules, learn actions by class in that same order.

### Initiative & Activation

*   When a player receives the Initiative, they begin their Round as the Active player and receive 2 Action Points
    [ AP ] to spend on an In-Play Ready character of their choice. That character, and its model, becomes the Active character and model; it becomes Activated and receives the Initiative.
*   A character receives the Initiative just once per Turn, but may become Activated and be the Active character many times in order to perform Actions. It may even become Active during another character’s Initiative.
    *   When a character becomes Active but has Delay tokens, those must first be removed by spending 1 AP each.
    *   The controlling player can then announce and then spend the character’s remaining APs by picking from the available Simple, Special, or Complex actions shown in the following lists. Most Actions are 1 AP each.
    *   Actions can be aborted before any Tests are performed.
*   After a character has finished its activations for its Initiative, mark it with a Done token.
*   Note that some traits and statuses may cause characters to have compulsory actions. See the section on Morale, Fear, and Rally Tests.

### Pushing

Once per Initiative, at the option of the player; Active characters having no Delay tokens may use “Pushing” to push themselves to their limit and acquire 1 AP. They will also immediately acquire a Delay token.

### Reacts (△)

Individual Actions may be interrupted by Opposing models which use Reacts; allow each player time to announce any Reacts. See the section on Reacts for more information.

### Using Agility (△)

Agility is a feature of Movement actions which can be used during actions to navigate difficult or unusual terrain. A character normally has Agility equal to half of MOV in MU.

Agility can also be used for when determining LOS.

See the section on Performing Movement Actions on how to use Agility.

## Simple Actions

*   **Move** — If Free pay 1 AP.
    *   If Engaged, must pass a Disengage action.
    *   If Free, move model up to its MOV + 2" acknowledging terrain and Agility limitations; stop if become Engaged with Attentive Opposing model.
    *   Must move in straight segments but may perform up to MOV direction changes during the course of movement. Allow an additional facing change before the use of any trait with the Movement keyword.
    *   Allow models to use Swap Positions when qualified.
    *   See the section on Performing Movement for more information.
*   **Close Combat Attack** — Pay 1 AP. Attack a model within Melee Range and LOS as the target. Unless using a Natural weapon, acquire a Delay token if this is not the character’s first attack this Initiative.
    *   Must use a weapon identified as “Melee” or “Natural”. Other Items can be used as an Improvised Melee weapon.
    *   Allow models to use Overreach when qualified.
    *   Apply Situational Test Modifiers as necessary.
    *   There is a Hit Test and upon passing, also a Damage Test.
    See the section on Performing Close Combat for more information.
*   **Range Combat Attack** — Pay 1 AP. If Free, attack a location or a model as the target, using a weapon that has an OR value. It must be within LOS if attacking directly, or within LOF if attacking indirectly (not covered in these QSR rules). Unless using a Natural weapon, acquire a Delay token if this is not the character’s first attack this Initiative.
    *   Must use a weapon identified with an OR value such as “Thrown”, “Bow”, “Firearm”, “Support”, or “Range”. Other Items can be used as Improvised Thrown weapon.
    *   Thrown weapons, and weapons with the Throwable trait have an OR equal to the character's STR.
    *   Apply Situational Test Modifiers as necessary.
    *   There is a Hit Test and upon passing, also a Damage Test.
    See the section on Performing Direct Range Combat for more information.
*   **Disengage** — Pay 1 AP. If Engaged, perform this as a +1 Base die Close Combat Hit Test, but using REF vs. CCA instead, with an Ordered Opposing target to which this model is Engaged, as selected by the Opposing player.
    *   Apply Situational Test Modifiers as necessary.
    *   Upon pass, reposition the Active model MOV × 1".
    *   Presume the Active character is the Defender.
    See the section on Performing Disengage for more information.

## Special Actions

*   **Concentrate** — Pay 1 AP. Combine once with any other action. If that action has a Test, specify one Active Test to benefit as follows:
    *   Receive +1 Wild die for a specified Active Test such as the Attacker Hit Test, Attacker Damage Test, Active Rally Test, Attacker Link Test, etc. This choice must be declared before any Tests are performed.
    *   If for the Attacker Hit Test, ignore the Maximum OR Multiple, and double all ORs used for the Action; Visibility, Range Attack, Rally, Cohesion, etc.
*   **Rally** — Pay 1 AP. If Free, a character may perform an Unopposed POW “Rally Test”, for itself or a Free Friendly model within Cohesion. The target becomes the Active model when scoring the Test.
    *   Apply Situational Test Modifiers as necessary.
    *   Upon pass, remove one Fear token for each cascade.
    *   Characters may only benefit from Rally once per Turn.
    *   “Friendly” — If an Attentive Ordered Friendly model in Cohesion receive +1m.
    *   “Safety” — Receive +1 Wild die if behind Cover or out of LOS, and not within 2 AP Movement of Opposing models.
*   **Fiddle** — If Free, the first Fiddle action costs zero AP, unless specified as costing 1 AP. Otherwise 1 AP. Each Fiddle action requires one Hand [1H]. If Free, do something simple with an Item, object, switch, or target.
    *   If agreed between players, require an Unopposed Test, known as a Fiddle Test, using a specific attribute to accomplish something not covered by the rules. Apply a Difficulty Rating [ DR ] of 1, 2, or 3 as deemed appropriate. These Fiddle Tests always require 1 AP.
    *   Apply Situational Test Modifiers as necessary.
    *   “Help” — Each Free Attentive Ordered Friendly model in base-contact with the target may provide +1 Modifier die if given a Delay token.
*   **Revive** — Pay 1 AP. If Free, a character may perform an Unopposed FOR “Revive Test”, for itself or a Free Friendly model in base-contact. The target becomes the Active model when scoring the Test.
    *   Apply Situational Test Modifiers as necessary.
    *   Upon pass, spend cascades to remove Delay and Wounds.
    *   If the target was KO’d, spend a cascade to right the model and identify it as Done. Assign it as many Delay tokens as its SIZ, but at least two. Replace all but two of the Delay tokens with Wound tokens.
    *   Spend 1 cascade to remove each Delay token, and spend 2 cascades to remove each Wound token.
    *   Characters may only benefit from Revive once per Turn.
*   **Combined (△)** — Pay 2 AP. Perform a Move action and then perform any other Action or actions that total 1 AP or less at any time during that move. Allow use of Pushing during this action. Place a pawn as a reminder of the location where it started movement.

## Complex Actions

*   **Hide** — Pay 1 AP. If Free, mark model in LOS but behind Cover as Hidden. If not in LOS, it is zero AP. Using Hidden status requires vigilance from all players to recognize when it can be used or needs to be removed.
    *   When Hidden; Visibility and Cohesion distance are halved unless not within Opposing LOS, and all Terrain is degraded except for that crossed using Agility. Ignore this rule if the entire path of movement is out of LOS from all Revealed Opposing models.
    *   Passive models must lose Hidden status if without Cover during the Active model’s movement or use of Agility (such as Leaning, Jumping, or Climbing), or after it uses reposition. Allow them to first reposition up MOV × 1".
    *   If the Active model is without Cover at the start of its Initiative, it loses its Hidden status. Allow it to reposition.
    *   If the Active model and one or more Passive models become without Cover from each other, allow the Passive models to first reposition. All models must lose their Hidden status, but the Active model may not reposition.
    *   The Active model may voluntarily remove Hidden status at the start or end of its Action. It must remove Hidden status when it is out of Cover. It will not reposition.
    *   Models further than Visibility × 3 do not automatically lose Hidden status unless within LOS of Opposing models in in Wait status.
    *   “Suddenness” — Models which were Hidden at the start of an action receive +1 Modifier die Combat Hit Tests.
    See Performing Movement under Resolving Actions for more information regarding repositioning.
*   **Detect** — The first Detect costs zero AP. Otherwise 1 AP. If Free perform a Detect Test as an Opposed REF Test against a Hidden target within LOS to remove its Hidden status and make it Revealed.
    *   Detect OR is equal to Visibility.
    *   Apply Situational Test Modifiers as necessary.
*   **Wait (△)** — Pay 2 AP if not Outnumbered to acquire Wait status and marker. Remove at the start of this character's next Initiative. If already in Wait status at the start of Initiative, pay 1 AP to maintain if Free, otherwise must remove.
    *   During Wait status, may remove it to perform a React. Even when in Done status.
    *   While in Wait status, double Visibility OR. All Hidden Opposing models in LOS but not in Cover are immediately Revealed.
    *   When in Wait status, and involuntarily acquire a Delay token, must remove both instead.
    *   “Focus” — Remove Wait status while Attentive to receive +1 Wild die for any Test instead of performing a React.
    *   “Waiting” — All characters in Wait status receive +1 REF when qualifying for a React.