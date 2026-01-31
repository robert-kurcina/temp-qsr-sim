import * as THREE from 'three';
import { LOSSystem } from './LOSSystem.js';

// Constants based on the rule definitions
const VISIBILITY_THRESHOLD = 0.6; // If less than 60% of the model is visible, it's considered in cover.
const BASE_CONTACT_DISTANCE = 1.5; // Leeway distance in MU to be considered in base-contact.

/**
 * A system to analyze the cover status between two models based on terrain obstructions.
 */
export class CoverSystem {
  /**
   * @param {LOSSystem} losSystem - An instance of the LOSSystem for visibility checks.
   */
  constructor(losSystem) {
    this.losSystem = losSystem;
  }

  /**
   * Analyzes the cover between an attacker and a target.
   * @param {object} attackerModel - The model initiating the attack.
   * @param {object} targetModel - The model being targeted.
   * @returns {{directCover: boolean, hardCover: boolean, interveningCover: boolean}} - A report on the cover status.
   */
  analyzeCover(attackerModel, targetModel) {
    const report = {
      directCover: false,
      hardCover: false,
      interveningCover: false,
    };

    // 1. Get the detailed obstruction report from the LOS system.
    const obstructionReport = this.losSystem.getObstructionReport(attackerModel, targetModel);

    // 2. Check for Intervening Cover.
    // According to the rules, if LOS is not perfectly clear, there may be cover.
    // We'll define this as less than 100% visibility.
    if (obstructionReport.visibility < 1) {
        // If the target is obscured by about half, it has intervening cover.
        if (obstructionReport.visibility <= VISIBILITY_THRESHOLD) {
            report.interveningCover = true;
        }
    }

    // If there's no intervening cover, there can be no other cover types.
    if (!report.interveningCover) {
      return report;
    }

    // 3. Check for Direct Cover and Hard Cover.
    // This requires iterating through the objects that are actually causing the obstruction.
    for (const obstruction of obstructionReport.obstructions) {
      // Check distance for Direct Cover.
      const distanceToTarget = new THREE.Vector3(obstruction.position.x, obstruction.position.y, 0)
        .distanceTo(targetModel.position);

      // Simple radius check for base contact.
      // A more sophisticated check would use the actual geometry.
      const targetRadius = targetModel.baseRadiusMU * 0.5;
      const obstructionRadius = (obstruction.size.width / 2); // Approximate radius
      
      if (distanceToTarget <= targetRadius + obstructionRadius + BASE_CONTACT_DISTANCE) {
        report.directCover = true;

        // Check for Hard Cover.
        // If any piece of direct cover is hard, the target benefits from Hard Cover.
        if (this.isHardCover(obstruction)) {
          report.hardCover = true;
        }
      }
    }

    return report;
  }

  /**
   * Determines if a terrain object provides Hard Cover.
   * @param {object} terrainObject - The terrain object to check.
   * @returns {boolean}
   */
  isHardCover(terrainObject) {
    // Buildings and walls are considered Hard Cover.
    return terrainObject.type === 'building' || terrainObject.type === 'wall';
  }
}
