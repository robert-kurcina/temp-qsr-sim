import { describe, it, expect, beforeEach } from 'vitest';
import {
  POIManager,
  PointOfInterest,
  POIType,
  ZoneShape,
  ZoneControlState,
  createPOI,
  createControlZones,
  createBeaconZones,
  createExtractionZones,
} from './poi-zone-control';
import { SpatialModel } from './battlefield/spatial/spatial-rules';

const createModel = (id: string, x: number, y: number, baseDiameter = 1): SpatialModel => ({
  id,
  position: { x, y },
  baseDiameter,
  siz: 3,
});

describe('POIManager', () => {
  let manager: POIManager;
  let poi: PointOfInterest;

  beforeEach(() => {
    manager = new POIManager();
    poi = createPOI({
      id: 'poi-1',
      name: 'Test Zone',
      position: { x: 5, y: 5 },
      radius: 3,
      vpPerTurn: 1,
      vpFirstControl: 2,
    });
    manager.addPOI(poi);
  });

  describe('createPOI', () => {
    it('should create a POI with defaults', () => {
      const newPOI = createPOI({ position: { x: 0, y: 0 } });

      expect(newPOI.type).toBe(POIType.ControlZone);
      expect(newPOI.shape).toBe(ZoneShape.Circle);
      expect(newPOI.radius).toBe(2);
      expect(newPOI.vpPerTurn).toBe(1);
    });

    it('should create a POI with custom config', () => {
      const newPOI = createPOI({
        id: 'custom',
        name: 'Custom Zone',
        type: POIType.Beacon,
        shape: ZoneShape.Rectangle,
        position: { x: 10, y: 10 },
        radius: 5,
        height: 3,
        vpPerTurn: 2,
        vpFirstControl: 5,
      });

      expect(newPOI.id).toBe('custom');
      expect(newPOI.type).toBe(POIType.Beacon);
      expect(newPOI.shape).toBe(ZoneShape.Rectangle);
      expect(newPOI.radius).toBe(5);
      expect(newPOI.height).toBe(3);
    });
  });

  describe('addPOI / getPOI', () => {
    it('should add and retrieve a POI', () => {
      const retrieved = manager.getPOI('poi-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('poi-1');
    });

    it('should return undefined for unknown POI', () => {
      const retrieved = manager.getPOI('unknown');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllPOIs', () => {
    it('should return all POIs', () => {
      const poi2 = createPOI({ id: 'poi-2', position: { x: 10, y: 10 } });
      manager.addPOI(poi2);

      const all = manager.getAllPOIs();
      expect(all.length).toBe(2);
    });
  });

  describe('getPOIsByType', () => {
    it('should return POIs with specified type', () => {
      const beacon = createPOI({ id: 'beacon', type: POIType.Beacon, position: { x: 0, y: 0 } });
      manager.addPOI(beacon);

      const beacons = manager.getPOIsByType(POIType.Beacon);
      expect(beacons.length).toBe(1);
      expect(beacons[0].id).toBe('beacon');
    });
  });

  describe('getPOIsByControlState', () => {
    it('should return POIs with specified control state', () => {
      poi.controlState = ZoneControlState.Controlled;
      poi.controlledBy = 'SideA';

      const poi2 = createPOI({ id: 'poi-2', position: { x: 0, y: 0 } });
      poi2.controlState = ZoneControlState.Contested;
      manager.addPOI(poi2);

      const controlled = manager.getPOIsByControlState(ZoneControlState.Controlled);
      expect(controlled.length).toBe(1);
      expect(controlled[0].id).toBe('poi-1');
    });
  });

  describe('getPOIsControlledBy', () => {
    it('should return POIs controlled by a side', () => {
      poi.controlState = ZoneControlState.Controlled;
      poi.controlledBy = 'SideA';

      const poi2 = createPOI({ id: 'poi-2', position: { x: 0, y: 0 } });
      poi2.controlState = ZoneControlState.Controlled;
      poi2.controlledBy = 'SideB';
      manager.addPOI(poi2);

      const sideAPOIs = manager.getPOIsControlledBy('SideA');
      expect(sideAPOIs.length).toBe(1);
    });
  });

  describe('isPositionInPOI', () => {
    it('should return true for position inside circle', () => {
      const result = manager.isPositionInPOI({ x: 6, y: 5 }, 'poi-1');
      expect(result).toBe(true);
    });

    it('should return false for position outside circle', () => {
      const result = manager.isPositionInPOI({ x: 20, y: 20 }, 'poi-1');
      expect(result).toBe(false);
    });

    it('should handle rectangle zones', () => {
      const rectPOI = createPOI({
        id: 'rect',
        shape: ZoneShape.Rectangle,
        position: { x: 10, y: 10 },
        radius: 2,
        height: 3,
      });
      manager.addPOI(rectPOI);

      expect(manager.isPositionInPOI({ x: 11, y: 11 }, 'rect')).toBe(true);
      expect(manager.isPositionInPOI({ x: 20, y: 20 }, 'rect')).toBe(false);
    });
  });

  describe('isModelInPOI', () => {
    it('should return true for model inside POI', () => {
      const model = createModel('m1', 6, 5);
      const result = manager.isModelInPOI(model, 'poi-1');
      expect(result).toBe(true);
    });

    it('should return false for model outside POI', () => {
      const model = createModel('m1', 20, 20);
      const result = manager.isModelInPOI(model, 'poi-1');
      expect(result).toBe(false);
    });
  });

  describe('getModelsInPOI', () => {
    it('should return all models inside POI', () => {
      const model1 = createModel('m1', 6, 5);
      const model2 = createModel('m2', 7, 5);
      const model3 = createModel('m3', 20, 20);

      const models = [model1, model2, model3];
      const inPOI = manager.getModelsInPOI('poi-1', models);

      expect(inPOI.length).toBe(2);
      expect(inPOI.map(m => m.id)).toContain('m1');
      expect(inPOI.map(m => m.id)).toContain('m2');
    });
  });

  describe('updateModelsInPOIs', () => {
    it('should update models in all POIs', () => {
      const model1 = createModel('m1', 6, 5);
      const model2 = createModel('m2', 20, 20);

      manager.updateModelsInPOIs([model1, model2]);

      expect(poi.modelsInZone).toContain('m1');
      expect(poi.modelsInZone).not.toContain('m2');
    });
  });

  describe('updateControlState', () => {
    it('should set control to single side when only one side present', () => {
      const model1 = createModel('m1', 6, 5);
      const model2 = createModel('m2', 7, 5);
      const models = [model1, model2];
      const sideMapping = new Map([['m1', 'SideA'], ['m2', 'SideA']]);

      const result = manager.updateControlState('poi-1', models, sideMapping);

      expect(result.success).toBe(true);
      expect(poi.controlState).toBe(ZoneControlState.Controlled);
      expect(poi.controlledBy).toBe('SideA');
      expect(result.victoryPointsAwarded).toBe(2); // vpFirstControl
    });

    it('should set control to contested when multiple sides present', () => {
      const model1 = createModel('m1', 6, 5);
      const model2 = createModel('m2', 7, 5);
      const models = [model1, model2];
      const sideMapping = new Map([['m1', 'SideA'], ['m2', 'SideB']]);

      const result = manager.updateControlState('poi-1', models, sideMapping);

      expect(result.success).toBe(true);
      expect(poi.controlState).toBe(ZoneControlState.Contested);
      expect(poi.controlledBy).toBeUndefined();
    });

    it('should set control to uncontrolled when no models present', () => {
      const result = manager.updateControlState('poi-1', [], new Map());

      expect(result.success).toBe(true);
      expect(poi.controlState).toBe(ZoneControlState.Uncontrolled);
    });

    it('should not award VP for maintaining control', () => {
      poi.controlState = ZoneControlState.Controlled;
      poi.controlledBy = 'SideA';

      const model1 = createModel('m1', 6, 5);
      const sideMapping = new Map([['m1', 'SideA']]);

      const result = manager.updateControlState('poi-1', [model1], sideMapping);

      expect(result.victoryPointsAwarded).toBe(0);
    });
  });

  describe('awardTurnControlVP', () => {
    it('should award VP for controlled zones', () => {
      poi.controlState = ZoneControlState.Controlled;
      poi.controlledBy = 'SideA';

      const vp = manager.awardTurnControlVP();

      expect(vp.get('SideA')).toBe(1); // vpPerTurn
      expect(poi.turnsControlled).toBe(1);
    });

    it('should not award VP for contested zones', () => {
      poi.controlState = ZoneControlState.Contested;

      const vp = manager.awardTurnControlVP();

      expect(vp.size).toBe(0);
    });

    it('should accumulate VP for multiple zones', () => {
      poi.controlState = ZoneControlState.Controlled;
      poi.controlledBy = 'SideA';

      const poi2 = createPOI({ id: 'poi-2', position: { x: 0, y: 0 }, vpPerTurn: 2 });
      poi2.controlState = ZoneControlState.Controlled;
      poi2.controlledBy = 'SideA';
      manager.addPOI(poi2);

      const vp = manager.awardTurnControlVP();

      expect(vp.get('SideA')).toBe(3); // 1 + 2
    });
  });

  describe('lockPOI / unlockPOI', () => {
    it('should lock a POI', () => {
      const result = manager.lockPOI('poi-1');

      expect(result).toBe(true);
      expect(poi.controlState).toBe(ZoneControlState.Locked);
    });

    it('should unlock a POI', () => {
      manager.lockPOI('poi-1');
      const result = manager.unlockPOI('poi-1');

      expect(result).toBe(true);
      expect(poi.controlState).toBe(ZoneControlState.Uncontrolled);
    });
  });

  describe('destroyPOI', () => {
    it('should destroy a POI', () => {
      const result = manager.destroyPOI('poi-1');

      expect(result).toBe(true);
      expect(poi.controlState).toBe(ZoneControlState.Destroyed);
      expect(poi.modelsInZone.length).toBe(0);
    });
  });

  describe('getTotalControlVP', () => {
    it('should calculate total VP from zone control', () => {
      poi.controlState = ZoneControlState.Controlled;
      poi.controlledBy = 'SideA';
      poi.turnsControlled = 3;
      poi.vpPerTurn = 2;
      poi.vpFirstControl = 5;

      const total = manager.getTotalControlVP('SideA');

      expect(total).toBe(11); // 2*3 + 5
    });
  });

  describe('exportState / importState', () => {
    it('should export and import POI state', () => {
      poi.controlState = ZoneControlState.Controlled;
      poi.controlledBy = 'SideA';
      poi.turnsControlled = 2;

      const exported = manager.exportState();
      const newManager = new POIManager();
      newManager.importState(exported);

      const imported = newManager.getPOI('poi-1');
      expect(imported?.controlState).toBe(ZoneControlState.Controlled);
      expect(imported?.controlledBy).toBe('SideA');
      expect(imported?.turnsControlled).toBe(2);
    });
  });
});

describe('POI creation helpers', () => {
  describe('createControlZones', () => {
    it('should create control zones at positions', () => {
      const positions = [{ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 10, y: 10 }];
      const zones = createControlZones(positions, { vpPerTurn: 2 });

      expect(zones.length).toBe(3);
      expect(zones.every(z => z.type === POIType.ControlZone)).toBe(true);
      expect(zones.every(z => z.vpPerTurn === 2)).toBe(true);
    });
  });

  describe('createBeaconZones', () => {
    it('should create beacon zones', () => {
      const positions = [{ x: 1, y: 1 }, { x: 5, y: 5 }];
      const zones = createBeaconZones(positions);

      expect(zones.length).toBe(2);
      expect(zones.every(z => z.type === POIType.Beacon)).toBe(true);
      expect(zones.every(z => z.vpPerTurn === 2)).toBe(true);
      expect(zones.every(z => z.vpFirstControl === 5)).toBe(true);
    });
  });

  describe('createExtractionZones', () => {
    it('should create extraction zones', () => {
      const positions = [{ x: 1, y: 1 }, { x: 5, y: 5 }];
      const zones = createExtractionZones(positions);

      expect(zones.length).toBe(2);
      expect(zones.every(z => z.type === POIType.ExtractionPoint)).toBe(true);
      expect(zones.every(z => z.vpPerTurn === 0)).toBe(true);
    });
  });
});
