export const MEST_QSR = {
  victoryConditions: {
    aggression: {
      vp: 1,
      rp: 5
    },
    bottled: {
      vp: 2
    },
    elimination: {
      vp: 1
    },
    outnumbered: {
      vp: {
        twoToOne: 2,
        threeToTwo: 1
      }
    }
  },
  endGame: {
    endGameTrigger: {
      gameSize: {
        small: {
          endGameBegins: 6
        },
        medium: {
          endGameBegins: 8
        },
        large: {
          endGameBegins: 10
        }
      }
    }
  }
};
