// /src/engine/Constants.js
/**
 * MEST QSR canonical measurements
 * 1 MU = 1.25 inches = 30mm base diameter for SIZ 3 models
 * 1.25 inches = 0.03175 meters
 */

export const MU_TO_METERS = 0.03175; // 1.25 inches = 30mm
export const TERRAIN_COSTS = {
  clear: 1,      // 1 AP per MU
  rough: 2,      // 2 AP per MU
  difficult: 2,  // 2 AP per MU  
  impassable: Infinity
};