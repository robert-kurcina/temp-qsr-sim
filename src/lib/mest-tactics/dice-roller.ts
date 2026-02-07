
import { metricsService } from './MetricsService';

// --- Core Types --- //

export enum DiceType {
    Modifier = 'Modifier',
    Base = 'Base',
    Wild = 'Wild',
}

export type DicePool = {
    [DiceType.Modifier]?: number;
    [DiceType.Base]?: number;
    [DiceType.Wild]?: number;
};

export interface TestParticipant {
    attributeValue: number;
    bonusDice?: DicePool;
    penaltyDice?: DicePool;
    isSystemPlayer?: boolean;
}

export interface TestResult {
    pass: boolean;
    score: number;
    participant1Score: number;
    participant2Score: number;
    p1Rolls: number[];
    p2Rolls: number[];
    p1Misses: number;
    p2Misses: number;
    finalPools: {
        p1FinalBonus: DicePool,
        p1FinalPenalty: DicePool,
        p2FinalBonus: DicePool,
        p2FinalPenalty: DicePool
    };
    carryOverDice?: DicePool;
}

// --- Roller Abstraction for Mocking --- //

export type Roller = (diceCount: number) => number[];

const _randomRoller: Roller = (diceCount: number) => {
    if (diceCount <= 0) return [];
    const rolls: number[] = [];
    for (let i = 0; i < diceCount; i++) {
        rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    return rolls;
};

let activeRoller: Roller = _randomRoller;

export function setRoller(newRoller: Roller) {
    activeRoller = newRoller;
}

export function resetRoller() {
    activeRoller = _randomRoller;
}

// --- Success & Dice Calculation --- //

function getSuccesses(rolls: number[], type: DiceType): number {
    let successes = 0;
    const flatRolls = rolls.flat(); // Defensive flattening
    for (const roll of flatRolls) {
        if (type === DiceType.Modifier) {
            if (roll >= 4) successes++;
        } else if (type === DiceType.Base) {
            if (roll >= 4 && roll <= 5) successes++;
            else if (roll === 6) successes += 2;
        } else { // Wild
            if (roll >= 4 && roll <= 5) successes++;
            else if (roll === 6) successes += 3;
        }
    }
    return successes;
}

export function mergeDicePools(...pools: (DicePool | undefined)[]): DicePool {
    const result: DicePool = {};
    for (const pool of pools) {
        if (!pool) continue;
        for (const type in pool) {
            const key = type as DiceType;
            result[key] = (result[key] || 0) + (pool[key] || 0);
        }
    }
    return result;
}

// --- Main Test Resolution Logic --- //

export function resolveTest(
    participant1: TestParticipant,
    participant2: TestParticipant,
    scoreModifier: number = 0,
    passOnTie: boolean = false
): TestResult {
    // 1. Determine base dice pools
    const p1BasePool: DicePool = participant1.isSystemPlayer ? {} : { [DiceType.Base]: 2 };
    const p2BasePool: DicePool = participant2.isSystemPlayer ? {} : { [DiceType.Base]: 2 };

    // 2. Determine total bonus pools before flattening
    const p1TotalBonus = mergeDicePools(participant1.bonusDice, participant2.penaltyDice);
    const p2TotalBonus = mergeDicePools(participant2.bonusDice, participant1.penaltyDice);

    // 3. Flatten the bonus pools
    const p1FinalBonus: DicePool = {};
    const p2FinalBonus: DicePool = {};
    const allDiceTypes: DiceType[] = [DiceType.Base, DiceType.Modifier, DiceType.Wild];

    for (const type of allDiceTypes) {
        const p1b = p1TotalBonus[type] || 0;
        const p2b = p2TotalBonus[type] || 0;
        const cancel = Math.min(p1b, p2b);
        if (p1b - cancel > 0) p1FinalBonus[type] = p1b - cancel;
        if (p2b - cancel > 0) p2FinalBonus[type] = p2b - cancel;
    }

    // 4. Create final dice pools for rolling
    const p1Pool = mergeDicePools(p1BasePool, p1FinalBonus);
    const p2Pool = mergeDicePools(p2BasePool, p2FinalBonus);

    // 5. Roll dice and calculate successes
    let p1Successes = 0;
    let p1Misses = 0;
    const p1Rolls: number[] = [];
    for (const type in p1Pool) {
        const diceCount = p1Pool[type as DiceType];
        if (diceCount && diceCount > 0) {
            const rolls = activeRoller(diceCount);
            const flatRolls = Array.isArray(rolls) ? rolls.flat() : [rolls]; // Ensure flat array
            p1Rolls.push(...flatRolls);
            p1Successes += getSuccesses(flatRolls, type as DiceType);
            p1Misses += flatRolls.filter(r => r === 1).length;
        }
    }

    let p2Successes = 0;
    let p2Misses = 0;
    const p2Rolls: number[] = [];
    for (const type in p2Pool) {
        const diceCount = p2Pool[type as DiceType];
        if (diceCount && diceCount > 0) {
            const rolls = activeRoller(diceCount);
            const flatRolls = Array.isArray(rolls) ? rolls.flat() : [rolls]; // Ensure flat array
            p2Rolls.push(...flatRolls);
            p2Successes += getSuccesses(flatRolls, type as DiceType);
            p2Misses += flatRolls.filter(r => r === 1).length;
        }
    }
    
    // 6. Calculate final scores
    const p1Score = (participant1.attributeValue || 0) + p1Successes + scoreModifier;
    const p2Score = (participant2.attributeValue || 0) + p2Successes;
    
    const score = p1Score - p2Score;
    const pass = passOnTie ? score >= 0 : score > 0;

    // 7. Return result
    const result: TestResult = {
        pass,
        score,
        participant1Score: p1Score,
        participant2Score: p2Score,
        p1Rolls,
        p2Rolls,
        p1Misses,
        p2Misses,
        finalPools: {
            p1FinalBonus,
            p1FinalPenalty: participant1.penaltyDice || {},
            p2FinalBonus,
            p2FinalPenalty: participant2.penaltyDice || {}
        },
    };

    metricsService.logEvent('diceTestResolved', result);
    return result;
}
