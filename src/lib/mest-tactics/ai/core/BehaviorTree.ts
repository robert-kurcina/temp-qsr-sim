/**
 * Behavior Tree Implementation
 * 
 * A flexible decision-making system where nodes represent decisions,
 * actions, and control flow.
 */

import { AIContext, ActionDecision, ActionType } from './AIController';

/**
 * Behavior tree node status
 */
export enum NodeStatus {
  /** Node is still running (async action in progress) */
  RUNNING = 'RUNNING',
  /** Node succeeded */
  SUCCESS = 'SUCCESS',
  /** Node failed */
  FAILURE = 'FAILURE',
}

/**
 * Base behavior tree node
 */
export abstract class BehaviorNode {
  /** Node name for debugging */
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Execute this node
   */
  abstract execute(context: AIContext): NodeStatus;

  /**
   * Called when node starts execution
   */
  onEnter?(context: AIContext): void;

  /**
   * Called when node finishes execution
   */
  onExit?(context: AIContext, status: NodeStatus): void;
}

/**
 * Selector Node
 * 
 * Tries children in order until one succeeds.
 * Returns FAILURE if all children fail.
 */
export class SelectorNode extends BehaviorNode {
  children: BehaviorNode[];

  constructor(name: string, children: BehaviorNode[]) {
    super(name);
    this.children = children;
  }

  execute(context: AIContext): NodeStatus {
    for (const child of this.children) {
      const status = child.execute(context);
      if (status === NodeStatus.SUCCESS) {
        return NodeStatus.SUCCESS;
      }
      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }
    }
    return NodeStatus.FAILURE;
  }
}

/**
 * Sequence Node
 * 
 * Executes all children in order.
 * Returns SUCCESS only if all children succeed.
 */
export class SequenceNode extends BehaviorNode {
  children: BehaviorNode[];
  private currentChild: number = 0;

  constructor(name: string, children: BehaviorNode[]) {
    super(name);
    this.children = children;
  }

  execute(context: AIContext): NodeStatus {
    while (this.currentChild < this.children.length) {
      const child = this.children[this.currentChild];
      const status = child.execute(context);

      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }
      if (status === NodeStatus.FAILURE) {
        this.currentChild = 0; // Reset for next time
        return NodeStatus.FAILURE;
      }
      this.currentChild++;
    }

    this.currentChild = 0; // Reset for next time
    return NodeStatus.SUCCESS;
  }
}

/**
 * Parallel Node
 * 
 * Executes all children each tick.
 * Returns SUCCESS if required number of children succeed.
 */
export class ParallelNode extends BehaviorNode {
  children: BehaviorNode[];
  /** Minimum children that must succeed */
  requiredSuccesses: number;

  constructor(name: string, children: BehaviorNode[], requiredSuccesses?: number) {
    super(name);
    this.children = children;
    this.requiredSuccesses = requiredSuccesses ?? children.length;
  }

  execute(context: AIContext): NodeStatus {
    let successCount = 0;
    let runningCount = 0;

    for (const child of this.children) {
      const status = child.execute(context);
      if (status === NodeStatus.SUCCESS) {
        successCount++;
      } else if (status === NodeStatus.RUNNING) {
        runningCount++;
      }
    }

    if (successCount >= this.requiredSuccesses) {
      return NodeStatus.SUCCESS;
    }
    if (runningCount > 0) {
      return NodeStatus.RUNNING;
    }
    return NodeStatus.FAILURE;
  }
}

/**
 * Decorator Node
 * 
 * Wraps a single child and modifies its behavior.
 */
export abstract class DecoratorNode extends BehaviorNode {
  child: BehaviorNode;

  constructor(name: string, child: BehaviorNode) {
    super(name);
    this.child = child;
  }
}

/**
 * Inverter Node
 * 
 * Inverts the result of its child.
 */
export class InverterNode extends DecoratorNode {
  constructor(name: string, child: BehaviorNode) {
    super(name, child);
  }

  execute(context: AIContext): NodeStatus {
    const status = this.child.execute(context);
    if (status === NodeStatus.SUCCESS) {
      return NodeStatus.FAILURE;
    }
    if (status === NodeStatus.FAILURE) {
      return NodeStatus.SUCCESS;
    }
    return NodeStatus.RUNNING;
  }
}

/**
 * Repeater Node
 * 
 * Repeats its child a specified number of times.
 */
export class RepeaterNode extends DecoratorNode {
  maxRepeats: number;
  private currentRepeat: number = 0;

  constructor(name: string, child: BehaviorNode, maxRepeats: number) {
    super(name, child);
    this.maxRepeats = maxRepeats;
  }

  execute(context: AIContext): NodeStatus {
    while (this.currentRepeat < this.maxRepeats) {
      const status = this.child.execute(context);
      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }
      if (status === NodeStatus.FAILURE) {
        this.currentRepeat = 0;
        return NodeStatus.FAILURE;
      }
      this.currentRepeat++;
    }
    this.currentRepeat = 0;
    return NodeStatus.SUCCESS;
  }
}

/**
 * Condition Node
 * 
 * Checks a condition and returns SUCCESS or FAILURE.
 */
export class ConditionNode extends BehaviorNode {
  condition: (context: AIContext) => boolean;

  constructor(name: string, condition: (context: AIContext) => boolean) {
    super(name);
    this.condition = condition;
  }

  execute(context: AIContext): NodeStatus {
    return this.condition(context) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

/**
 * Action Node
 * 
 * Executes an action and returns the result.
 */
export class ActionNode extends BehaviorNode {
  action: (context: AIContext) => NodeStatus | ActionDecision | null;

  constructor(
    name: string,
    action: (context: AIContext) => NodeStatus | ActionDecision | null
  ) {
    super(name);
    this.action = action;
  }

  execute(context: AIContext): NodeStatus {
    const result = this.action(context);
    if (result === null) {
      return NodeStatus.FAILURE;
    }
    if (result === NodeStatus.RUNNING || result === NodeStatus.SUCCESS || result === NodeStatus.FAILURE) {
      return result;
    }
    // If it returns an ActionDecision, consider it success
    return NodeStatus.SUCCESS;
  }
}

/**
 * Utility Selector Node
 * 
 * Scores all children and executes the highest scoring one.
 * Used for tactical decision making.
 */
export class UtilitySelectorNode extends BehaviorNode {
  children: Array<{ node: BehaviorNode; scorer: (context: AIContext) => number }>;

  constructor(
    name: string,
    children: Array<{ node: BehaviorNode; scorer: (context: AIContext) => number }>
  ) {
    super(name);
    this.children = children;
  }

  execute(context: AIContext): NodeStatus {
    // Score all children
    const scores = this.children.map(({ node, scorer }) => ({
      node,
      score: scorer(context),
    }));

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    // Execute highest scoring child that succeeds
    for (const { node, score } of scores) {
      if (score <= 0) continue; // Skip if score is too low
      const status = node.execute(context);
      if (status !== NodeStatus.FAILURE) {
        return status;
      }
    }

    return NodeStatus.FAILURE;
  }
}

/**
 * Behavior Tree
 * 
 * Root container for behavior tree nodes.
 */
export class BehaviorTree {
  root: BehaviorNode;
  private lastStatus: NodeStatus = NodeStatus.FAILURE;

  constructor(root: BehaviorNode) {
    this.root = root;
  }

  /**
   * Execute the behavior tree from the root
   */
  execute(context: AIContext): NodeStatus {
    this.lastStatus = this.root.execute(context);
    return this.lastStatus;
  }

  /**
   * Get the last execution status
   */
  getLastStatus(): NodeStatus {
    return this.lastStatus;
  }

  /**
   * Get debug information about the tree
   */
  getDebugInfo(): string {
    return this.getNodeDebug(this.root, 0);
  }

  private getNodeDebug(node: BehaviorNode, depth: number): string {
    const indent = '  '.repeat(depth);
    let result = `${indent}${node.name}\n`;

    if ('children' in node) {
      const n = node as any;
      if (Array.isArray(n.children)) {
        for (const child of n.children) {
          result += this.getNodeDebug(child, depth + 1);
        }
      } else if (n.child) {
        result += this.getNodeDebug(n.child, depth + 1);
      }
    }

    return result;
  }
}

/**
 * Create a simple behavior tree for testing
 */
export function createTestBehaviorTree(): BehaviorTree {
  const root = new SelectorNode('Root', [
    new SequenceNode('Emergency', [
      new ConditionNode('IsKOd', (ctx) => ctx.character.state.isKOd),
      new ActionNode('TryRevive', (ctx) => NodeStatus.SUCCESS),
    ]),
    new SequenceNode('Combat', [
      new ConditionNode('HasEnemy', (ctx) => ctx.enemies.length > 0),
      new ActionNode('Attack', (ctx) => NodeStatus.SUCCESS),
    ]),
    new ActionNode('Hold', (ctx) => NodeStatus.SUCCESS),
  ]);

  return new BehaviorTree(root);
}
