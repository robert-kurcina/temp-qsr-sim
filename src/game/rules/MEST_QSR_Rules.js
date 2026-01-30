// Implements exact rules from your uploaded MEST QSR document
export const MEST_QSR = {
  // Victory Conditions (from your QSR)
  victoryConditions: {
    aggression: {
      description: "Aggression — +1 VP if at least half of the Assembly's models, by starting count, cross an imaginary line across the middle of the battlefield. Award +1 RP to the first model to cross.",
      vp: 1,
      rp: 1 // for first model
    },
    bottled: {
      description: "Bottled — +1 VP if Opposing Side failed Bottle Test [ 'Bottled Out' ] or has no Ordered characters. If there at least two Opposing Sides remaining in play, reward those sides each +3 Resource Points instead each time a Side 'Bottled Out'.",
      vp: 1,
      rp: 3 // for multi-player
    },
    elimination: {
      description: "Elimination — +1 VP if have most Opposing KO'd and Eliminated characters by BP total at game end. Doesn't include models Bottled.",
      vp: 1
    },
    outnumbered: {
      description: "Outnumbered — +1 VP to the Side that is outnumbered 3:2 models or greater at start of game, but +2 if outnumbered 2:1 models or greater. If there are multiple Sides remaining at the end of the game, do not award this keyword.",
      vp: { threeToTwo: 1, twoToOne: 2 }
    }
  },
  
  // End-game Rules (from your QSR)
  endGame: {
    endOfTurn: "After all models have been marked as Done status, the Turn has ended. At the end of the Turn, all Initiative Points not spent are lost. If at the end of a Turn it is determined that more than half of a player's forces have been KO'd or Eliminated, 'Breakpoint Morale' has been reached and a Bottle Test is required by that player.",
    endOfGame: "After the End of Turn is resolved, all players check to see if the game has ended.",
    endOfConflict: "If there are no remaining Opposing models, the game ends.",
    endGameTrigger: {
      description: "End-game Trigger represents a culminating event which forces the conclusion of a Mission... Use the Game Size per the total BP and adjust one row toward the total Models used to determine after which Turn the End-game Triggers are to be placed.",
      gameSize: {
        small: { models: "4 to 8", bp: 500, endGameBegins: 4 },
        medium: { models: "6 to 12", bp: 750, endGameBegins: 6 },
        large: { models: "8 to 16", bp: 1000, endGameBegins: 8 }
      },
      endDice: "END dice are regular six-sided dice, numbered 1 to 6. If any END die scores 1, 2, or 3 (a 'miss'), then the game ends immediately."
    }
  },
  
  // Trait Definitions (from your QSR)
  traits: {
    grit: {
      description: "Grit X — Psychology. Skill. Does not perform a Morale Test when a Friendly model is KO'd or Eliminated unless that model had higher POW. Reduce the first Fear token received when Attentive. Whenever receiving Fear tokens optionally convert up to X of those Fear tokens into Delay tokens instead.",
      type: ["Psychology", "Skill"]
    },
    impale: {
      description: "Impale — Distracted targets are penalized -1 Base die Defender Damage Test plus 1 per 3 Impact remaining. Use the lowest amount of Impact remaining for Defender if it had multiple types of Armor.",
      type: ["Attack Effect"]
    },
    stun: {
      description: "Stun X — Attack Effect. If the Active character passes the Attacker Close Combat Damage Test, or if adding X causes the Test to pass, then there may be a Stun effect. Add X to the number of successes scored by the Active character, and subtract the target's Durability, which is the higher of its SIZ or FOR. This is the Stun Test. The target acquires a Delay token as Stun damage if the Stun Test passes, and one more for every 3 additional cascades.",
      type: ["Attack Effect"]
    }
  }
};