import { ZoneConfig, ZoneType, FormationType, ZoneInstance } from '../mission-config';
import { Position } from '../battlefield/Position';

/**
 * Zone Factory
 * Creates zone instances from configuration
 */
export class ZoneFactory {
  /**
   * Create zones from configuration
   */
  static createZones(config: ZoneConfig, battlefieldCenter: Position = { x: 12, y: 12 }): ZoneInstance[] {
    const positions = this.calculatePositions(config, battlefieldCenter);

    return positions.map((position, index) => ({
      id: `${config.type}-zone-${index + 1}`,
      type: config.type,
      position,
      radius: config.radius ?? 3,
      state: {},
    }));
  }

  /**
   * Calculate zone positions based on formation
   */
  private static calculatePositions(config: ZoneConfig, center: Position): Position[] {
    const count = config.count;
    const spacing = config.spacing ?? 12;
    const formation = config.formation ?? FormationType.CIRCLE;

    switch (formation) {
      case FormationType.TRIANGLE:
        return this.createTriangle(center, spacing);
      case FormationType.DIAMOND:
        return this.createDiamond(center, spacing);
      case FormationType.CIRCLE:
        return this.createCircle(center, count, spacing);
      case FormationType.LINE:
        return this.createLine(center, count, spacing);
      case FormationType.CUSTOM:
        // For custom formations, positions would be provided separately
        return [center];
      default:
        return [center];
    }
  }

  /**
   * Create triangle formation (3 zones)
   */
  private static createTriangle(center: Position, spacing: number): Position[] {
    const offset = spacing / 2;
    return [
      { x: center.x, y: center.y - offset }, // Top
      { x: center.x - offset, y: center.y + offset }, // Bottom left
      { x: center.x + offset, y: center.y + offset }, // Bottom right
    ];
  }

  /**
   * Create diamond formation (4 zones)
   */
  private static createDiamond(center: Position, spacing: number): Position[] {
    const offset = spacing / 2;
    return [
      { x: center.x, y: center.y - offset }, // Top
      { x: center.x - offset, y: center.y }, // Left
      { x: center.x + offset, y: center.y }, // Right
      { x: center.x, y: center.y + offset }, // Bottom
    ];
  }

  /**
   * Create circle formation (N zones)
   */
  private static createCircle(center: Position, count: number, radius: number): Position[] {
    const positions: Position[] = [];
    const angleStep = (2 * Math.PI) / count;

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      positions.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    }

    return positions;
  }

  /**
   * Create line formation (N zones in a row)
   */
  private static createLine(center: Position, count: number, spacing: number): Position[] {
    const positions: Position[] = [];
    const totalLength = (count - 1) * spacing;
    const startX = center.x - totalLength / 2;

    for (let i = 0; i < count; i++) {
      positions.push({
        x: startX + i * spacing,
        y: center.y,
      });
    }

    return positions;
  }

  /**
   * Get recommended zone count for game size
   */
  static getRecommendedZoneCount(gameSize: string, zoneType: ZoneType): number {
    const recommendations: Record<string, Record<ZoneType, number>> = {
      SMALL: {
        [ZoneType.POI]: 2,
        [ZoneType.SIGNAL]: 2,
        [ZoneType.CACHE]: 3,
        [ZoneType.FOCAL_NODE]: 2,
        [ZoneType.THRESHOLD]: 1,
        [ZoneType.MECHANISM]: 2,
      },
      MEDIUM: {
        [ZoneType.POI]: 3,
        [ZoneType.SIGNAL]: 3,
        [ZoneType.CACHE]: 5,
        [ZoneType.FOCAL_NODE]: 3,
        [ZoneType.THRESHOLD]: 1,
        [ZoneType.MECHANISM]: 3,
      },
      LARGE: {
        [ZoneType.POI]: 4,
        [ZoneType.SIGNAL]: 4,
        [ZoneType.CACHE]: 7,
        [ZoneType.FOCAL_NODE]: 4,
        [ZoneType.THRESHOLD]: 1,
        [ZoneType.MECHANISM]: 3,
      },
    };

    return recommendations[gameSize]?.[zoneType] ?? 3;
  }

  /**
   * Get recommended spacing for game size
   */
  static getRecommendedSpacing(gameSize: string): number {
    switch (gameSize) {
      case 'SMALL':
        return 8;
      case 'MEDIUM':
        return 12;
      case 'LARGE':
        return 16;
      default:
        return 12;
    }
  }
}
