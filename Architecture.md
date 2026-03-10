# AI Battle Architecture

This document focuses on the runtime architecture in terms of:

- Planner
- Coordinator
- Runner
- Orchestrator

It also shows where Initiative Point (IP) spending is currently decided.

## 1) Components / Facilities

```mermaid
flowchart LR
  subgraph Entry["Entry / Orchestration"]
    CLI["CLI Entrypoints\nscripts/ai-battle-setup.ts\nscripts/run-battles/*"]
    ORCH["BattleOrchestrator\nscripts/ai-battle/core/BattleOrchestrator.ts"]
  end

  subgraph Runner["Runner Layer"]
    RUN["AIBattleRunner\nscripts/ai-battle/AIBattleRunner.ts"]
    TURN["BattleTurnCycleSupport\nrunBattleTurnCycleForRunner(...)"]
    ACT["CharacterTurnResolutionSupport\nresolveCharacterTurnForRunner(...)"]
  end

  subgraph Coordinator["Coordinator Layer"]
    SCM["SideCoordinatorManager\n(GameManager-owned)"]
    SAC["SideAICoordinator\nsrc/lib/mest-tactics/ai/core/SideAICoordinator.ts"]
  end

  subgraph Planner["Planner Layer"]
    CAI["CharacterAI\nsrc/lib/mest-tactics/ai/core/CharacterAI.ts"]
    US["UtilityScorer\nsrc/lib/mest-tactics/ai/core/UtilityScorer.ts"]
  end

  subgraph Engine["Engine / Rules Runtime"]
    GM["GameManager\ninitiative, activation, IP APIs"]
    BF["Battlefield + LOS/Pathing"]
    MRA["MissionRuntimeAdapter\nmission VP/RP updates"]
  end

  subgraph Output["Reporting / Validation"]
    REP["BattleReport Finalization + Formatter"]
    VAL["ValidationRunner / Metrics"]
  end

  CLI --> ORCH --> RUN
  RUN --> TURN --> ACT
  RUN --> GM
  TURN --> GM
  ACT --> GM

  GM --> SCM --> SAC
  ACT --> CAI --> US
  SAC --> CAI

  GM --> BF
  RUN --> MRA
  TURN --> MRA
  ACT --> MRA

  RUN --> REP
  RUN --> VAL

  TURN -. "IP spending currently implemented here:\nforce/maintain heuristics" .-> GM
  ACT -. "IP spending currently implemented here:\nrefresh heuristic" .-> GM
```

## 2) Sequence (Turn / Activation)

```mermaid
sequenceDiagram
  autonumber
  participant U as User/CLI
  participant O as Orchestrator
  participant R as AIBattleRunner
  participant T as TurnCycleSupport
  participant G as GameManager
  participant C as SideCoordinatorManager/SideAICoordinator
  participant P as CharacterAI+UtilityScorer
  participant A as CharacterTurnResolutionSupport
  participant M as MissionRuntimeAdapter
  participant B as Battle Report

  U->>O: Start battle command
  O->>R: runBattle(config)
  R->>G: setup sides, battlefield, mission runtime

  loop Each Turn
    T->>G: startTurn(...)
    G->>C: update scoring context
    T->>M: onTurnStart(...)

    loop While activations remain
      T->>G: attempt Force Initiative (opportunity-based)
      T->>G: getNextToActivate()
      T->>A: resolveCharacterTurn(character)
      A->>G: optional Refresh IP spend (opportunity-based)
      A->>P: decideAction(...)
      P-->>A: ActionDecision
      A->>G: execute action(s)
      A->>M: sync mission events from action outcomes

      T->>G: optional Maintain Initiative spend
      T->>A: resolve chained ally activation (if spent)
    end

    T->>M: onTurnEnd(...)
  end

  R->>B: finalize report (winner, reason, tie-break metadata)
```

## 3) Flow Notes

1. Orchestrator and CLI launch the canonical runner.
2. Runner owns battle setup, controller creation, and final report assembly.
3. Turn cycle owns queue-level orchestration and executes coordinator-issued `forceInitiative` + `maintainInitiative` decisions.
4. Character turn resolution owns per-model activation and executes coordinator-issued `refresh` decisions.
5. Planner (`CharacterAI` + `UtilityScorer`) selects actions for an active model, influenced by coordinator context.
6. Coordinator (`SideAICoordinator`) updates side strategy context each turn and exposes turn signals via `getInitiativeSignalForTurn(...)`; runner IP heuristics consume those signals before force/maintain/refresh spending.
7. Engine (`GameManager`) is the authority that executes IP spend APIs and activation order effects.

## 4) Current IP Ownership (Important)

As of now:

- `forceInitiative` policy is owned by `SideAICoordinator` (`recommendForceInitiativeSpend`), executed in runner turn orchestration.
- `maintainInitiative` policy is owned by `SideAICoordinator` (`recommendMaintainInitiativeSpend`), executed in runner turn orchestration.
- `refresh` policy is owned by `SideAICoordinator` (`recommendRefreshInitiativeSpend`), executed in character turn resolution.
- Runner-layer fallback heuristics are only used when coordinator decision APIs are unavailable.
