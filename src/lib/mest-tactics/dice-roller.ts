
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
}

// --- Roller Abstraction for Mocking --- //

export type Roller = (diceCount: number) => number[];

const _randomRoller: Roller = (diceCount: number) => {
    const rolls: number[] = [];
    for (let i = 0; i < diceCount; i++) {
        rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    return rolls;
};

let activeRoller: Roller = _randomRoller;

export function setRoller(newRoller: Roller | (() => number) | ((count: number) => number[])) {
    if (typeof newRoller === 'function' && newRoller.length === 0) {
        activeRoller = (diceCount: number) => Array(diceCount).fill(null).map(() => (newRoller as () => number)());
    } else {
        activeRoller = newRoller as Roller;
    }
}

export function resetRoller() {
    activeRoller = _randomRoller;
}

function getSuccesses(rolls: number[], type: DiceType): number {
    let successes = 0;
    for (const roll of rolls) {
        if (type === DiceType.Modifier) {
            if (roll >= 4) successes++;
        } else if (type === DiceType.Base) {
            if (roll >= 4 && roll <= 5) successes++;
            if (roll === 6) successes += 2;
        } else { // Wild
            if (roll >= 4 && roll <= 5) successes++;
            if (roll === 6) successes += 3;
        }
    }
    return successes;
}

// --- Main Test Resolution Logic --- //

function mergeDicePools(pool1: DicePool, pool2: DicePool): DicePool {
    const result: DicePool = { ...pool1 };
    for (const type in pool2) {
        const key = type as DiceType;
        result[key] = (result[key] || 0) + (pool2[key] || 0);
    }
    return result;
}

export function resolveTest(
    participant1: TestParticipant,
    participant2: TestParticipant,
    scoreModifier: number = 0,
    passOnTie: boolean = false
): TestResult {

    let p1Bonus = participant1.bonusDice || {};
    let p1Penalty = participant1.penaltyDice || {};
    let p2Bonus = participant2.bonusDice || {};
    let p2Penalty = participant2.penaltyDice || {};

    // Cancellation
    for (const type in p1Bonus) {
        const key = type as DiceType;
        const p1b = p1Bonus[key] || 0;
        const p2p = p2Penalty[key] || 0;
        const cancel = Math.min(p1b, p2p);
        p1Bonus[key] = p1b - cancel;
        p2Penalty[key] = p2p - cancel;
    }
    for (const type in p2Bonus) {
        const key = type as DiceType;
        const p2b = p2Bonus[key] || 0;
        const p1p = p1Penalty[key] || 0;
        const cancel = Math.min(p2b, p1p);
        p2Bonus[key] = p2b - cancel;
        p1Penalty[key] = p1p - cancel;
    }

    // Build final pools
    const p1BasePool = participant1.isSystemPlayer ? {} : { [DiceType.Base]: participant1.attributeValue };
    const p2BasePool = participant2.isSystemPlayer ? {} : { [DiceType.Base]: participant2.attributeValue };

    let p1Pool = mergeDicePools(p1BasePool, p1Bonus);
    let p2Pool = mergeDicePools(p2BasePool, p2Bonus);

    for (const type in p1Penalty) {
        const key = type as DiceType;
        p1Pool[key] = Math.max(0, (p1Pool[key] || 0) - (p1Penalty[key] || 0));
    }
    for (const type in p2Penalty) {
        const key = type as DiceType;
        p2Pool[key] = Math.max(0, (p2Pool[key] || 0) - (p2Penalty[key] || 0));
    }

    let p1Successes = 0;
    let p1Misses = 0;
    const p1Rolls: number[] = [];
    for (const type in p1Pool) {
        const key = type as DiceType;
        const diceCount = p1Pool[key];
        if (diceCount && diceCount > 0) {
            const rolls = activeRoller(diceCount);
            p1Rolls.push(...rolls);
            p1Successes += getSuccesses(rolls, key);
            p1Misses += rolls.filter(r => r === 1).length;
        }
    }

    let p2Successes = 0;
    let p2Misses = 0;
    const p2Rolls: number[] = [];
    for (const type in p2Pool) {
        const key = type as DiceType;
        const diceCount = p2Pool[key];
        if (diceCount && diceCount > 0) {
            const rolls = activeRoller(diceCount);
            p2Rolls.push(...rolls);
            p2Successes += getSuccesses(rolls, key);
            p2Misses += rolls.filter(r => r === 1).length;
        }
    }

    const p1Score = participant1.attributeValue + p1Successes;
    const p2Score = participant2.attributeValue + p2Successes;
    const score = p1Score - p2Score + scoreModifier;
    const pass = passOnTie ? score >= 0 : score > 0;

    const result: TestResult = {
        pass,
        score,
        participant1Score: p1Score,
        participant2Score: p2Score,
        p1Rolls,
        p2Rolls,
        p1Misses,
        p2Misses,
        finalPools: { p1FinalBonus: p1Bonus, p1FinalPenalty: p1Penalty, p2FinalBonus: p2Bonus, p2FinalPenalty: p2Penalty },
    };

    metricsService.logEvent('diceTestResolved', result);
    return result;
}
