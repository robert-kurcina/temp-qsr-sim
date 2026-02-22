
# Project Blueprint: MEST Tactics Simulator

## 1. Overview

This project is a wargame simulator designed to run in Firebase Studio. The goal is to create a flexible and performant simulator that can be easily extended with new rules and scenarios.

**Project Evolution:**
- **Phase 1 (Complete):** Headless simulation engine with spatial awareness
- **Phase 2 (Complete):** Mission system with 4 of 10 missions implemented
- **Phase 3 (Planned):** Web UI for local play
- **Phase 4 (Planned):** Online multiplayer platform with authentication, social features, and cloud deployment

## 2. The Blueprint: Our Shared Source of Truth

**This document is the anchor for my behavior.**

Its purpose is to serve as our shared, persistent memory and single source of truth for the project. I will consult this document before every major action to ensure my behavior is consistent and aligned with the project's established rules and your expectations.

1.  **To Anchor Behavior:** The "Core Operating Principles," "Development Principles," "Development Environment," and "Testing and Debugging Methodology" sections are my explicit rulebook.
2.  **To Document the Project:** It acts as living, high-level documentation of the project's architecture, data models, and core logic.
3.  **To Manage Workflow:** The "Current Task" section is our shared to-do list, ensuring we are always on the same page.

My update process for this document is to **Read, Modify, and Write**. I will always read the file first, perform a targeted, non-destructive update, and then write the complete file back.

## 3. Core Operating Principles

1.  **Single Source of Truth:** The project's local files are the absolute and only source of truth. All data, including but not limited to character archetypes, items, weapons, armor, and game rules, MUST be drawn directly from the JSON files in `src/data/` and the markdown files (e.g., `rules.md`).
2.  **No Fabrication:** Under no circumstances should information be invented, fabricated, or inferred from external knowledge. If a piece of data does not exist explicitly in the project's files, it cannot be used.
3.  **Filesystem First:** Before making any changes or additions to the codebase, the filesystem must be scanned to confirm the presence or absence of relevant files.
4.  **Headless First Development:** All development must be focused on the core, headless simulation logic. UI-related files, dependencies (Astro, React, etc.), and configurations are to be ignored until explicitly commanded to work on them. The primary interface for the application is the command line.

### Filesystem Integrity

1.  **Always Audit Before Creating:** Before creating any new file, especially for a core module like `Character`, `Item`, or `DiceRoller`, I will **always** first list the files in the target directory to check for existing conflicts.
2.  **Refactor = Move, Verify, THEN Delete:** When refactoring by moving files, I will now follow a strict "move, verify, delete" sequence. I will not consider the refactor complete until the old file is explicitly deleted and the system is tested again.

## 4. Development Environment & Toolchain

*   **Testing Framework:** Vitest
*   **Transpiler:** TypeScript compiler (`tsc`)
*   **Module System:** ES Modules
*   **Target Environment:** Node.js
*   **TypeScript Execution:** `tsx`

## 5. Development Principles

1.  **Unit Testing as a Priority:** Every new feature, rule, or piece of logic must be accompanied by a comprehensive set of unit tests.
2.  **Separation of Responsibilities (SOLID):** The codebase will adhere to SOLID design principles, with a strong emphasis on the Single Responsibility Principle. Complex processes will be broken down into smaller, modular, and independently testable subroutines.
3.  **No Regular Expressions for Complex Parsing:** Avoid using regular expressions for parsing structured strings with multiple, potentially ambiguous parts (e.g., damage formulas). Instead, use simple, character-by-character string manipulation to ensure clarity, predictability, and ease of debugging. Regex should only be used for simple, well-defined pattern matching.
4.  **Debugging with Console Logs:** When unit tests fail, introduce `console.log` statements to the relevant code to help with debugging. These logs should be removed only after a successful `npm test` run.
5.  **Declare and Use Variables for Function Arguments:** Always declare variables for function arguments. Never pass a non-variable argument to a function.

## 6. Testing and Debugging Methodology

To ensure a stable and predictable codebase, the following systematic approach will be used to address all unit test failures:

1.  **Isolate and Prioritize:** When a test run results in failures, identify the **least dependent failing test**.
2.  **Focus on a Single Test:** Concentrate all efforts on fixing this single, isolated test.
3.  **Iterate Until Passing:** Run the test repeatedly in isolation until it passes. No other tests will be addressed during this time.
4.  **Incremental Progression:** Once the test passes, move to the next least dependent failing test and repeat the process until all tests in a file are passing.
5.  **File-by-File Completion:** Once all tests in a file pass, move to the next file with failing tests and repeat the process.
6.  **Full Suite Validation:** After all tests in all files pass, run the entire test suite one final time to confirm success.
7.  **`TypeError` is a Structural Red Flag:** `TypeError` and `ReferenceError` will be treated not just as code errors, but as high-priority red flags for potential structural problems like duplicate modules. I will investigate the file system *before* the code logic in these cases.

## 7. Codebase Conventions & Standards

1.  **Dice Enum:** The enum for dice variations will be named `DiceType` (plural).
2.  **Result Interfaces:** Interfaces for action results will be named descriptively (e.g., `DisengageResult`).

## 8. Game Documentation

*   [Mastery](src/guides/docs/mastery.md)
*   [Rules](src/guides/docs/rules.md)

## 8.1 Context Anchors (Non-UI Docs)

The project includes markdown files that serve as **AI context anchors** to narrow behavior and ensure consistent rule interpretation. These are **not** UI content and are **not** intended to be treated as Astro content collections or rendered in any interface. They may be stored outside `src/content` to avoid Astro content-collection warnings.

## 9. Project Implementation Details

### Core Mechanics

*   **Dice Types:** `Base`, `Modifier`, `Wild`.
*   **Success & Carry-Over:** Defined in `getDieSuccesses`. The key is that a roll generates successes and can *also* generate a single carry-over die for a subsequent round.
*   **`performTest`:** Executes a *single round* of dice rolls and reports the score and any carry-over dice. It does **not** recursively roll carry-over dice.
*   **`resolveTest`:** The high-level orchestrator for a contested roll between two participants. It calculates dice pools, calls `performTest` for each, and determines the final outcome.

### Actions

*   **`makeDisengageAction`:** The primary implemented action. It gathers situational modifiers (`isCornered`, `isFlanked`, etc.) and uses `resolveTest` to determine the result.

### Data Model

*   **`Character`**, **`Profile`**, **`Item`**.
*   Game data is stored statically in `src/lib/data.ts`.

## 10. Current Task: Capture Spatially Aware Game Requirements

### Completed Steps

1.  **Corrected `dice-roller.ts` and `dice-roller.test.ts`:** The core dice-rolling logic is now fixed and validated.
2.  **Established `blueprint.md`:** This document has been created and refined to serve as our single source of truth.
3.  **Corrected `hit-test.test.ts`:** All tests related to hit resolution are now passing.
4.  **Implemented `damage-parser.ts`:** The damage formula parser has been rewritten to use robust string manipulation instead of regular expressions.
5.  **Implemented `damage.ts` and `damage.test.ts`:** The core damage subroutine and its tests are now fully implemented and passing, ensuring correct wound calculation, status effects (KO/Elimination), and dice modifier handling.
6.  **Refactored `Character.ts` to a class:** `Character.ts` is now a class that takes a `Profile` in its constructor.
7.  **Created `types.ts`:** `FinalAttributes` and `ArmorState` are now in a separate file.
8.  **Updated `battlefield.test.ts`:** The test now uses the new `Character` class structure.
9.  **All unit tests passing:** Full suite is green.
10. **Implemented profile/assembly pipeline:** Added profile builder and assembly creation helpers to turn archetypes + items into characters within an assembly.

### Next Steps

Define and implement the minimum game loop and spatial model required by the QSR to make the simulator "spatially aware" and playable:

1.  **Battlefield Model (Spatial Awareness Core)**  
    Represent a battlefield with measurable MU distances, model base sizes (diameter/height), and model volumes for LOS checks. Support LOS/LOF rules, including blocking terrain, cover determination (direct/intervening), and visibility OR constraints.
2.  **Terrain & Movement Rules**  
    Encode terrain categories (Clear, Rough, Difficult, Blocking) and movement costs, including base-contact constraints, engagement, and agility-based movement exceptions.
3.  **Mission Setup & Game Size**  
    Implement mission configuration for the default “Elimination” mission, including game size assumptions (Small), model count, and BP budget constraints.
4.  **Turn & Action Loop (Playable Flow)**  
    Implement turn structure with Ready/Done statuses, core actions (Move, Close Combat Attack, Ranged Attack, Disengage), and basic status token handling (Hidden, Wound, Delay, Fear, KO, Eliminated).

### Spatial Awareness Priorities (2D Footprint Placeholder)

Model volume is temporarily treated as a 2D footprint (base circle/mesh). Priorities are ordered from least-dependent to most-dependent:

1.  **Model registry + measurement utilities**
2.  **Engagement + melee range checks**
3.  **LOS + LOF integration (2D footprint)**
4.  **Cover classification (direct/intervening, hard/soft/blocking)**
5.  **Cohesion + situational awareness**
6.  **Safety + compulsory actions**
7.  **Hidden/Detect/Wait spatial interactions**

### Mission Side Wiring (Near-Term Plan)

1.  **MissionSide bindings**  
    Establish a side-level container that binds Assemblies to a Side and assigns portrait call signs, model slots, positions, and per-character status. This is the primary home for side-specific state.
2.  **Assembly merge builder**  
    Provide a helper to combine multiple Assemblies into a single composite roster (e.g., 250 BP + 500 BP → 750 BP) before assigning to a Side.
3.  **Side assignment flow**  
    Allow multiple Assemblies to be assigned to a Side (with or without merging) and maintain a single roster with consistent identifiers.

### Future UI Flow (Non-Blocking)

At some point a UI will be needed to:
- Build Profiles
- Build Characters from Profiles
- Build Assemblies from Characters
- Assign Assemblies to Mission Sides

## 11. Mission Engine Roadmap

### Scope Summary

Full mission implementation includes: a data-driven mission engine, objective marker system, POI control, VIP logic, mission keys, and mission-specific triggers integrated into `GameController` and `mission-flow`, with unit tests.

### Priority Order (Least Impact First)

1.  **QAI Mission 1: Elimination**
2.  **QAI Mission 12: Engagement**
3.  **QAI Mission 14: Beacon**
4.  **QAI Mission 16: Exfil**
5.  **QAI Mission 15: Extraction Point**
6.  **QAI Mission 13: Sabotage**
7.  **QAI Mission 18: Ghost Protocol**
8.  **QAI Mission 20: Switchback**
9.  **QAI Mission 17: Triad**
10. **QAI Mission 19: Last Stand**

### Shared Feature Modules (Engine Work)

These modules unlock multiple missions and should be built before mission-specific logic.

1.  **Core mission engine (data-driven)**
2.  **Mission keys/scoring extensions** (Dominance, Courier, Sanctuary, First Blood, Catalyst, Collection, POI, Targeted, etc.)
3.  **POI / zone control**
4.  **Objective Markers (OM) system**
5.  **VIP system**
6.  **Reinforcements system**
7.  **Mission event hooks** (end-of-turn triggers, immediate win conditions)

### Estimated Token Budget (Implementation + Tests)

These are rough estimates for implementation + tests + wiring.

**Shared Feature Modules**
1.  Core mission engine: 3,500–5,000
2.  POI / zone control: 1,800–2,600
3.  Objective Markers system: 3,500–5,500
4.  VIP system: 2,200–3,200
5.  Reinforcements: 2,000–3,000
6.  Mission keys/scoring extensions: 2,800–4,200
7.  Mission event hooks: 1,500–2,500

**Mission Implementations**
1.  Elimination: 800–1,200 ✅ **Complete** (unchanged)
2.  Convergence (was Engagement): 2,500–3,600 ✅ **Complete**
3.  Dominion (was Beacon): 1,800–2,800 ✅ **Complete**
4.  Assault (was Sabotage): 3,000–4,500 ✅ **Complete**
5.  Recovery (was Extraction Point): 4,000–6,000 ✅ **Complete**
6.  Escort (was Exfil): 3,000–4,500 ✅ **Complete**
7.  Stealth (was Ghost Protocol): 4,500–6,500 ✅ **Complete**
8.  Triumvirate (was Triad): 4,500–6,500 ✅ **Complete**
9.  Defiance (was Last Stand): 5,500–8,000 ✅ **Complete**
10. Breach (was Switchback): 3,500–5,000 ✅ **Complete**

---

## 12. Online Multiplayer Platform

### Vision

Transform the headless simulator into a full-featured online gaming platform where players can:
- Create accounts and manage profiles
- Play games against other players online
- Track statistics and rankings
- Share results and connect with friends

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (Astro + React)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Lobby   │ │  Game    │ │  Profile │ │  Social/Dashboard│   │
│  │  Screen  │ │  Board   │ │  Screen  │ │  (Leaderboards)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Services (Node.js)                   │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐   │
│  │  Game Server │ │  Auth Server │ │  Social API Service    │   │
│  │  (WebSocket) │ │  (OAuth/JWT) │ │  (Leaderboards, etc.)  │   │
│  └──────────────┘ └──────────────┘ └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer (Firebase)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │Firestore │ │  Auth    │ │  Storage │ │  Realtime DB     │   │
│  │  (DB)    │ │  (Users) │ │(Avatars) │ │  (Presence)      │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 4A: Core Platform (Priority 1 - Foundation)

#### 1. Authentication & Account Management
**Token Budget: 8,000–12,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **OAuth Integration** | Google, GitHub, Discord login | 2,500–3,500 | P0 |
| **Email/Password Auth** | Traditional account creation | 1,500–2,000 | P0 |
| **MFA (TOTP)** | Time-based one-time passwords | 2,000–3,000 | P1 |
| **Account Management** | Profile edit, password reset, delete | 1,500–2,500 | P0 |
| **Session Management** | JWT tokens, refresh tokens, logout | 500–1,000 | P0 |

#### 2. Player Profiles & Avatars
**Token Budget: 5,000–8,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Player Profiles** | Username, bio, stats, preferences | 1,500–2,500 | P0 |
| **Avatar System** | Upload, crop, store avatar images | 2,000–3,000 | P1 |
| **Player Names** | Unique names, name history, changes | 500–1,000 | P0 |
| **Privacy Settings** | Public/private profiles, visibility | 500–1,000 | P1 |
| **Linked Accounts** | Connect Discord, Slack, email | 500–1,000 | P2 |

#### 3. Game Lobby & Matchmaking
**Token Budget: 10,000–15,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Lobby System** | Create/join game rooms | 2,500–4,000 | P0 |
| **Player Selection** | Number of players (1-4), sides | 1,000–1,500 | P0 |
| **Bot Configuration** | AI difficulty, bot names | 1,500–2,500 | P0 |
| **Human Player Slots** | Open/closed slots, invites | 1,500–2,500 | P0 |
| **Game Settings** | Mission selection, house rules | 1,500–2,500 | P1 |
| **Ready System** | Ready/not-ready, host controls | 1,000–1,500 | P0 |
| **Matchmaking** | Quick play, ranked, casual | 2,000–3,000 | P2 |

---

### Phase 4B: Online Play (Priority 2 - Core Experience)

#### 4. Real-Time Game Coordination
**Token Budget: 15,000–22,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **WebSocket Server** | Real-time bidirectional communication | 3,000–5,000 | P0 |
| **Game State Sync** | Sync board state across players | 3,000–4,000 | P0 |
| **Turn Management** | Turn timers, notifications, AFK handling | 2,500–4,000 | P0 |
| **Action Validation** | Server-side move validation | 2,000–3,000 | P0 |
| **Reconnection** | Resume disconnected games | 2,000–3,000 | P1 |
| **Game History** | Save/load game state | 1,500–2,500 | P1 |
| **Spectator Mode** | Watch ongoing games | 1,000–2,000 | P2 |

#### 5. Central Coordination Service
**Token Budget: 8,000–12,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Game Orchestration** | Start/end games, cleanup | 2,000–3,000 | P0 |
| **Presence System** | Online/offline status | 1,000–1,500 | P0 |
| **Notification Service** | Push notifications, emails | 2,000–3,000 | P1 |
| **Rate Limiting** | API throttling, anti-abuse | 1,000–1,500 | P0 |
| **Logging & Metrics** | Game analytics, error tracking | 1,500–2,500 | P1 |
| **Health Monitoring** | Service health, alerts | 500–1,000 | P1 |

---

### Phase 4C: Social Features (Priority 3 - Engagement)

#### 6. Leaderboards & Statistics
**Token Budget: 6,000–9,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Global Leaderboards** | ELO, wins, rankings | 2,000–3,000 | P1 |
| **Player Statistics** | Win/loss, favorite missions, stats | 1,500–2,500 | P1 |
| **Seasonal Rankings** | Monthly/seasonal leaderboards | 1,500–2,500 | P2 |
| **Achievements** | Badges, milestones, unlocks | 1,000–1,500 | P2 |

#### 7. Game History & Sharing
**Token Budget: 5,000–8,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Game History** | Past games, replays, results | 2,000–3,000 | P1 |
| **Share Button** | Share results to social media | 1,000–1,500 | P1 |
| **Game Replays** | Watch past games | 1,500–2,500 | P2 |
| **Export Data** | Download game logs, stats | 500–1,000 | P2 |

#### 8. Chat & Communication
**Token Budget: 8,000–12,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **In-Game Chat** | Text chat during games | 2,500–4,000 | P1 |
| **Lobby Chat** | Pre-game communication | 1,500–2,500 | P1 |
| **Direct Messages** | Player-to-player messaging | 2,000–3,000 | P2 |
| **Chat Moderation** | Filters, reporting, blocking | 1,500–2,500 | P1 |
| **Emotes/Reactions** | Quick reactions, emotes | 500–1,000 | P2 |

#### 9. Third-Party Integrations
**Token Budget: 6,000–10,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Discord Integration** | OAuth, server linking, bots | 2,500–4,000 | P1 |
| **Slack Integration** | Workspace linking, notifications | 2,000–3,000 | P2 |
| **Webhooks** | External event notifications | 1,000–2,000 | P2 |
| **API for Bots** | Discord bot API | 500–1,000 | P2 |

---

### Phase 4D: Cloud Deployment (Priority 0 - Infrastructure)

#### 10. Cloud Infrastructure
**Token Budget: 10,000–15,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Firebase Setup** | Firestore, Auth, Storage, Functions | 2,500–4,000 | P0 |
| **Cloud Deployment** | Vercel/Netlify for frontend | 1,500–2,500 | P0 |
| **WebSocket Hosting** | Railway/Render for game servers | 2,000–3,000 | P0 |
| **CDN Configuration** | Asset delivery, caching | 1,000–1,500 | P1 |
| **Environment Config** | Dev/staging/prod environments | 1,000–1,500 | P0 |
| **CI/CD Pipeline** | Automated testing, deployment | 2,000–3,000 | P1 |

#### 11. Security & Compliance
**Token Budget: 8,000–12,000**

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Data Encryption** | At-rest and in-transit encryption | 2,000–3,000 | P0 |
| **GDPR Compliance** | Data export, deletion, consent | 2,000–3,000 | P1 |
| **COPPA Compliance** | Age verification, parental consent | 1,500–2,500 | P2 |
| **Security Audits** | Penetration testing, vulnerability scans | 1,500–2,500 | P1 |
| **Backup & Recovery** | Automated backups, disaster recovery | 1,000–1,500 | P0 |

---

### Implementation Priority Summary

| Phase | Features | Total Tokens | Cumulative |
|-------|----------|--------------|------------|
| **4A** | Auth, Profiles, Lobby | 23,000–35,000 | 23,000–35,000 |
| **4B** | Real-Time Play, Coordination | 23,000–34,000 | 46,000–69,000 |
| **4C** | Social, Leaderboards, Chat | 25,000–39,000 | 71,000–108,000 |
| **4D** | Cloud, Security | 18,000–27,000 | 89,000–135,000 |

**Total Estimated Token Budget: 89,000–135,000 tokens**

---

### Technical Stack Recommendations

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Astro + React | Existing setup, SSR + interactivity |
| **Backend** | Node.js + Express | Consistent with existing codebase |
| **Real-Time** | Socket.io or ws | WebSocket abstraction, rooms |
| **Database** | Firebase Firestore | Real-time sync, offline support |
| **Auth** | Firebase Auth + OAuth | Built-in providers, MFA support |
| **Storage** | Firebase Storage | Avatars, game replays |
| **Hosting** | Vercel (FE) + Railway (BE) | Easy deployment, scaling |
| **Email** | SendGrid or Resend | Transactional emails |
| **Analytics** | PostHog or Mixpanel | User behavior tracking |

---

### Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Scope Creep** | High | High | Phase features strictly, MVP first |
| **Security Breach** | Critical | Medium | Security audits, best practices |
| **Latency Issues** | High | Medium | Edge deployment, optimization |
| **Cost Overrun** | Medium | Medium | Monitor usage, set budgets |
| **Low Adoption** | High | Medium | Community building, marketing |

---

### Success Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| **Registered Users** | 1,000 | 3 months post-launch |
| **Daily Active Users** | 100 | 3 months post-launch |
| **Games Played/Day** | 50 | 3 months post-launch |
| **User Retention (D7)** | 40% | 3 months post-launch |
| **Average Session** | 20 minutes | 3 months post-launch |

---

## 13. Current Status

### Completed (Phases 1-2)
- ✅ Spatial awareness system (model registry, LOS, engagement, cover)
- ✅ Mission Side wiring (assemblies, positions, status)
- ✅ Objective Markers system
- ✅ VIP system
- ✅ POI/Zone Control system
- ✅ Reinforcements system
- ✅ Mission Event Hooks
- ✅ 10 of 10 missions implemented (Elimination, Convergence, Assault, Dominion, Recovery, Escort, Triumvirate, Stealth, Defiance, Breach)
- ✅ All 823 unit tests passing
- ✅ Mission/terminology renaming complete
- ✅ Combat traits framework (`combat-traits.ts`) with 23 trait implementations

### In Progress
- ✅ Combat traits integration — **100% complete**

### Combat Traits Implementation Status

#### Implemented (in `src/lib/mest-tactics/traits/combat-traits.ts`)

| Trait | QSR Rule | Implementation Status |
|-------|----------|----------------------|
| **Cleave X** | KO → Elimination, extra wounds for level 2+ | ✅ Complete |
| **Parry X** | +Xm Defender Close Combat Tests | ✅ Complete |
| **Reach X** | +X MU melee range | ✅ **Integrated** |
| **Conceal** | WYSIWYG exception, Hide bonus | ✅ Complete |
| **Discrete** | WYSIWYG exception (any number) | ✅ Complete |
| **Coverage X** | Ignore engaged models, share benefits | ✅ Complete |
| **Deflect X** | +Xm Defender Hit Tests (not Engaged Range) | ✅ Complete |
| **Grit X** | Morale exemption, Fear reduction/conversion | ✅ Complete |
| **Perimeter** | Base-contact restriction, defense bonus | ✅ **Integrated** |
| **Protective X** | Discard Delay from Stun (with conditions) | ✅ Complete |
| **Reload X** | Weapon state tracking | ✅ **Integrated** |
| **Throwable** | OR = STR, no Accuracy bonus | ✅ Complete |
| **Charge** | +1 Wild die Damage, +1 Impact on charge | ✅ **Integrated** |
| **[Stub]** | No Overreach, penalty conditions | ✅ Complete |
| **[Lumbering]** | Upgrade penalties to Base dice | ✅ Complete |
| **[Blinders]** | Scrum penalty, Bow/Thrown restrictions | ✅ Complete |
| **Brawl X** | Cascade bonus, mutual reduction | ✅ **Integrated** |
| **Fight X** | Penalty reduction, bonus actions | ✅ **Integrated** |
| **Shoot X** | Penalty reduction, Max ORM bonus | ✅ Complete |
| **Archery** | +Xm Bow Hit Test | ✅ Complete |
| **Scholar** | +Xm INT Tests | ✅ Complete |
| **Insane** | Psychology immunity, Morale exemption | ✅ **Integrated** |
| **[Coward]** | Additional Fear on failed Morale | ✅ **Integrated** |
| **Stun X** | Full Stun Test calculation | ✅ **Integrated** |
| **Natural Weapon** | Multiple attacks, no Overreach | ✅ Complete |
| **[Awkward]** | Extra AP when engaged, Delay on Charge | ✅ **Integrated** |
| **[Hafted]** | -1m Defender Close Combat Hit Tests | ✅ **Integrated** |
| **[Discard]** | Limited use (3 variants) | ✅ **Integrated** |
| **Acrobatic X** | +X Wild dice Defender Close Combat | ✅ **Integrated** |
| **Bash** | +1 cascade Bonus Actions when Charging | ✅ **Integrated** |
| **Brawn X** | +X STR except Close Combat Damage | ✅ Complete |
| **Detect X** | +X Base dice Detect, +X Max ORM | ✅ **Integrated** |
| **Evasive X** | +Xm per ORM Defender Range Hit, reposition | ✅ **Integrated** |
| **Impale** | -1b Defender Damage vs Distracted | ✅ **Integrated** |
| **Knife-fighter X** | +Xb +X Impact with [Stub] weapons | ✅ **Integrated** |
| **Leadership X** | +Xb Morale Tests in Visibility | ✅ **Integrated** |
| **Leap X** | +X" Agility for Movement/reposition | ✅ **Integrated** |
| **Melee** | Weapon trait for Engaged combat | ✅ Complete |
| **Sneaky X** | Auto-Hide, +Xm Suddenness, start Hidden | ✅ **Integrated** |
| **Sprint X** | +X×2" Movement (straight), +X×4" if Attentive Free | ✅ **Integrated** |
| **Surefooted X** | Upgrade terrain effects | ✅ **Integrated** |
| **Tactics X** | +Xb Initiative Tests, avoid Situational Awareness | ✅ **Integrated** |
| **Unarmed** | -1m CCA, STR-1m Damage, counts as [Stub] | ✅ **Integrated** |

**Total: 43 combat traits implemented and integrated**

#### Integration Summary

| Trait | Integration | File(s) |
|-------|-------------|---------|
| **Cleave** | KO → Elimination, extra wounds | `close-combat.ts` |
| **Stun** | Delay tokens from Stun X | `damage-test.ts` |
| **Charge** | +1m Hit, +1 Impact Damage | `close-combat.ts`, `damage-test.ts` |
| **Parry** | +Xm Defender Close Combat | `close-combat.ts` |
| **Knife-fighter** | +Xb +X Impact with [Stub] | `close-combat.ts` |
| **Hafted** | -1m Defender penalty | `close-combat.ts` |
| **Awkward** | Delay on Charge, extra AP | `close-combat.ts` |
| **Bash** | +1 cascade on Charge | `close-combat.ts` |
| **Fight** | Bonus actions on higher Fight | `combat-actions.ts` |
| **Brawl** | Bonus actions on failed hit (Delay cost) | `combat-actions.ts` |
| **Perimeter** | Attentive-only engagement | `engagement-manager.ts` |
| **Reach** | +X MU melee range | `engagement-manager.ts` |
| **Insane** | Morale exemption, Hindrance immunity | `morale.ts`, `morale-test.ts` |
| **Coward** | +1 Fear on failed Morale | `morale.ts` |
| **Leadership** | +Xb Morale Tests | `morale-test.ts` |
| **Reload** | Fiddle action tracking | `simple-actions.ts` |
| **Sneaky** | Auto-Hide at end of activation, Suddenness bonus | `combat-actions.ts`, `activation.ts` |
| **Sprint** | +X×2"/4" Movement bonus | `move-action.ts` |
| **Leap** | +X" Agility bonus | `move-action.ts` |
| **Surefooted** | Terrain upgrade (Rough→Clear, etc.) | `move-action.ts` |
| **Tactics** | +Xb Initiative Tests | `GameManager.ts` |
| **Unarmed** | -1m Hit/Damage penalties | `close-combat.ts` |
| **Acrobatic** | +X Wild dice Defender CC | `close-combat.ts` |
| **Detect** | +X Max ORM | `ranged-combat.ts` |
| **Evasive** | +Xm per ORM Defender Range Hit | `ranged-combat.ts` |
| **Impale** | -1b +1 per 3 Impact vs Distracted | `damage-test.ts` |
| **[Discard]** | Weapon usage tracking | `simple-actions.ts` |

**Integration Complete: 27/27 traits integrated**

### Planned: Phase 3 - Web UI for Local Play

#### Phase 3A: Minimal Playable UI (8,000–12,000 tokens)

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Battlefield Renderer** | 2D SVG battlefield with terrain, model tokens, zones | 2,500–3,500 | P0 |
| **Selection System** | Click-to-select, highlight valid targets, LOS indicators | 1,500–2,000 | P0 |
| **Action Panel** | Move, Attack, Disengage buttons, AP tracking | 1,500–2,000 | P0 |
| **Game State Display** | VP scoreboard, model status, turn/round, objectives | 1,000–1,500 | P0 |
| **Dice Roll Display** | Visual dice results, success counting | 500–1,000 | P1 |
| **Camera Controls** | Pan, zoom, focus on selected model | 1,000–1,500 | P1 |

#### Phase 3B: Full Local Play (15,000–20,000 tokens)

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Assembly Builder** | Select archetypes, build profiles, assign items, BP budget | 3,000–4,000 | P0 |
| **Mission Setup** | Mission selection, side config, deployment placement | 2,500–3,500 | P0 |
| **Deployment Phase** | Drag-and-drop deployment, zone validation | 2,000–3,000 | P0 |
| **Action Resolution** | Dice animation, hit/damage display, status tokens | 2,500–3,500 | P0 |
| **Movement Tools** | Move preview, engagement warnings, path validation | 2,000–3,000 | P0 |
| **Combat Flow** | Ranged/CC attack wizards, target selection, results | 2,000–3,000 | P0 |
| **Turn Management** | Ready/Done status, turn transitions, notifications | 1,000–1,500 | P0 |

#### Phase 3C: Polish & UX (5,000–8,000 tokens)

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Tooltips & Help** | Rule references, trait explanations, contextual help | 1,000–1,500 | P1 |
| **Animations** | Smooth transitions, combat effects, status changes | 1,500–2,500 | P1 |
| **Sound Effects** | Dice rolls, combat hits, UI feedback | 1,000–1,500 | P2 |
| **Save/Load** | Local game state persistence | 1,000–1,500 | P1 |
| **Hotseat Mode** | Multiplayer on same device, player switching | 500–1,000 | P2 |

**Phase 3 Total: 28,000–40,000 tokens**

---

### Planned: Phase 4 - Online Multiplayer Platform

#### Phase 4A: Core Platform Foundation (23,000–35,000 tokens)

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **OAuth Integration** | Google, GitHub, Discord login | 2,500–3,500 | P0 |
| **Email/Password Auth** | Traditional account creation | 1,500–2,000 | P0 |
| **Player Profiles** | Username, bio, stats, preferences | 1,500–2,500 | P0 |
| **Avatar System** | Upload, crop, store avatar images | 2,000–3,000 | P1 |
| **Lobby System** | Create/join game rooms, player slots | 2,500–4,000 | P0 |
| **Bot Configuration** | AI difficulty, bot names, assembly selection | 1,500–2,500 | P0 |
| **Ready System** | Ready/not-ready, host controls, game start | 1,000–1,500 | P0 |
| **Matchmaking** | Quick play, ranked, casual queues | 2,000–3,000 | P2 |

#### Phase 4B: Real-Time Play (23,000–34,000 tokens)

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **WebSocket Server** | Real-time bidirectional communication | 3,000–5,000 | P0 |
| **Game State Sync** | Sync board state across players | 3,000–4,000 | P0 |
| **Turn Management** | Turn timers, notifications, AFK handling | 2,500–4,000 | P0 |
| **Action Validation** | Server-side move validation, anti-cheat | 2,000–3,000 | P0 |
| **Reconnection** | Resume disconnected games | 2,000–3,000 | P1 |
| **Game History** | Save/load game state, replay system | 1,500–2,500 | P1 |
| **Central Coordination** | Game orchestration, presence, notifications | 2,000–3,000 | P0 |

#### Phase 4C: Social Features (25,000–39,000 tokens)

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Leaderboards** | ELO, wins, global/seasonal rankings | 2,000–3,000 | P1 |
| **Player Statistics** | Win/loss, favorite missions, detailed stats | 1,500–2,500 | P1 |
| **Game History** | Past games, replays, results sharing | 2,000–3,000 | P1 |
| **In-Game Chat** | Text chat during games, emotes | 2,500–4,000 | P1 |
| **Discord Integration** | OAuth, server linking, bot commands | 2,500–4,000 | P1 |
| **Achievements** | Badges, milestones, unlocks | 1,000–1,500 | P2 |

#### Phase 4D: Cloud Deployment (18,000–27,000 tokens)

| Feature | Description | Tokens | Priority |
|---------|-------------|--------|----------|
| **Firebase Setup** | Firestore, Auth, Storage, Functions | 2,500–4,000 | P0 |
| **Cloud Deployment** | Vercel/Netlify FE, Railway/Render BE | 1,500–2,500 | P0 |
| **WebSocket Hosting** | Scaling, load balancing | 2,000–3,000 | P0 |
| **Security** | Data encryption, rate limiting, audits | 2,000–3,000 | P0 |
| **CI/CD Pipeline** | Automated testing, deployment | 2,000–3,000 | P1 |
| **Monitoring** | Logging, metrics, health checks | 1,500–2,500 | P1 |

**Phase 4 Total: 89,000–135,000 tokens**

---

### Implementation Priority Summary

| Phase | Features | Total Tokens | Cumulative |
|-------|----------|--------------|------------|
| **3A** | Minimal Playable UI | 8,000–12,000 | 8,000–12,000 |
| **3B** | Full Local Play | 15,000–20,000 | 23,000–32,000 |
| **3C** | Polish & UX | 5,000–8,000 | 28,000–40,000 |
| **4A** | Auth, Profiles, Lobby | 23,000–35,000 | 51,000–75,000 |
| **4B** | Real-Time Play | 23,000–34,000 | 74,000–109,000 |
| **4C** | Social, Leaderboards | 25,000–39,000 | 99,000–148,000 |
| **4D** | Cloud, Security | 18,000–27,000 | 117,000–175,000 |

**Grand Total: 117,000–175,000 tokens** (Phases 3 + 4)

---

### Recommended Next Step

**Start Phase 3A** with a minimal playable UI:
1. Set up Astro + React + Tailwind for the frontend
2. Create 2D SVG battlefield renderer
3. Add model selection and basic action buttons
4. Wire up the existing headless engine to the UI

This gives you a playable prototype quickly, which can then be extended with more features.

---

## 14. Directory Restructuring Effort (In Progress)

### Motivation

The original flat structure with 60+ files in `src/lib/mest-tactics/` had become difficult to navigate and maintain. Concerns were mixed (actions, combat, missions all at same level), making it hard to:
- Find related files quickly
- Understand module boundaries
- Add new features without risking breakage
- Onboard new developers (or AI agents)

### Target Structure

```
src/lib/mest-tactics/
├── core/              # Domain models (Character, Profile, Item, Trait, Assembly, Archetype, Attributes)
├── engine/            # Core engine (GameManager, GameController, EventLogger, MetricsService)
├── actions/           # All action logic (Move, Attack, Disengage, Activation, Bonus Actions, Interrupts)
├── combat/            # Combat subsystem (Close Combat, Ranged Combat, Indirect Ranged Combat)
├── battlefield/       # Spatial systems
│   ├── los/          # Line of fire operations (LOSValidator, LOFOperations)
│   ├── pathfinding/  # Navigation (Grid, Cell, NavMesh, Pathfinder, PathfindingEngine)
│   ├── rendering/    # SVG rendering (SvgRenderer, BattlefieldFactory)
│   ├── spatial/      # Engagement, model registry, spatial rules, size utils
│   ├── terrain/      # Terrain, terrain elements, move validation
│   └── validation/   # Action context validation
├── status/            # Status effects (Morale, Concealment, Compulsory Actions, Passive Options, Bottle Tests)
├── traits/            # Trait system (Combat Traits, Item Traits, Trait Parser, Trait Utils, Trait Logic Registry)
├── mission-system/    # Mission engine (MissionEngine, MissionSide, MissionSideBuilder, AssemblyBuilder,
│                      # Objective Markers, POI/Zone Control, VIP System, Reinforcements, Scoring Rules,
│                      # Special Rules, Victory Conditions, Zone Factory, Balance Validator, Heuristic Scorer)
├── missions/          # Individual mission implementations (10 missions: Elimination, Convergence, Dominion,
│                      # Assault, Recovery, Escort, Triumvirate, Stealth, Defiance, Breach)
├── subroutines/       # Low-level subroutines (Damage, Hit Test, Ranged Hit Test, Morale Test, Dice Roller)
└── utils/             # Factories and generators (Character Factory, Character Generator, Profile Generator,
                       # Name Generator, TestContext)
```

### Current Progress: **100% Complete** ✅

**Completed:**
- ✅ Directory structure created
- ✅ Core models moved to `core/` (8 files)
- ✅ Engine files moved to `engine/` (5 files)
- ✅ Actions module organized (22 files)
- ✅ Combat module organized (8 files)
- ✅ Battlefield subdirectories created (los/, pathfinding/, rendering/, spatial/, terrain/, validation/)
- ✅ Status module organized (6 files)
- ✅ Traits module organized (6 files)
- ✅ Mission-system module organized (27 files)
- ✅ Missions module organized (20 mission manager + test files)
- ✅ Subroutines module organized (5 files)
- ✅ Utils module organized (5 files)
- ✅ Index barrel exports added for `core/`, `engine/`, `battlefield/`, `combat/`
- ✅ All import paths fixed (80+ files)
- ✅ All 823 tests passing
- ✅ Committed to git

---

## 16. Root Directory Consolidation

### Motivation

After completing the `src/lib/mest-tactics/` restructure, the root directory still had scattered directories that needed consolidation:

**Issues Identified:**
1. **Scattered JSON data**: User-generated content (`assemblies/`, `characters/`, `profiles/`) at root, but canonical game data in `src/data/`
2. **Scattered assets**: `portraits/` and `svg/` at root, but portrait logic in `src/lib/portraits/`
3. **Generated output**: `svg-output/` at root without clear purpose
4. **Documentation split**: `docs/` at root vs `src/guides/docs/` for AI context anchors
5. **Missing root documentation**: No `CONTRIBUTING.md`, `CHANGELOG.md`, or expanded `README.md`

### Final Structure

```
/Users/kitrok/projects/temp-qsr-sim/
├── assets/                    # Visual assets
│   ├── portraits/             # Character portrait images
│   └── svg/
│       ├── terrain/           # Terrain SVG files
│       └── tokens/            # Game token/marker SVGs
├── data/                      # User-generated content
│   ├── assemblies/            # Team assemblies
│   ├── characters/            # Character instances
│   └── profiles/              # Character profiles
├── docs/                      # External documentation
│   ├── README.md              # Project overview
│   ├── CONTRIBUTING.md        # Development guide
│   └── CHANGELOG.md           # Version history
├── generated/                 # Generated output
│   └── svg-output/            # Generated battlefield SVGs
├── scripts/                   # Build/generate scripts
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── lib/
│   │   ├── mest-tactics/      # Core simulation engine
│   │   │   ├── actions/       # Game actions
│   │   │   ├── battlefield/   # Spatial systems
│   │   │   ├── combat/        # Combat resolution
│   │   │   ├── core/          # Domain models
│   │   │   ├── engine/        # Game engine
│   │   │   ├── mission/       # Mission system
│   │   │   ├── missions/      # Mission implementations
│   │   │   ├── status/        # Status effects
│   │   │   ├── subroutines/   # Low-level logic
│   │   │   ├── traits/        # Trait system
│   │   │   └── utils/         # Factories and helpers
│   │   └── portraits/         # Portrait logic
│   └── data/                  # Canonical JSON game data
├── astro.config.mjs
├── package.json
└── blueprint.md
```

### Completed Phases

#### **Phase 1: Quick Wins** ✅ (1-2 hours)
1. ✅ Created `assets/`, `data/`, `generated/` directories
2. ✅ Moved `portraits/` → `assets/portraits/`
3. ✅ Moved `svg/` → `assets/svg/` (renamed `play-aides/` → `tokens/`)
4. ✅ Moved `assemblies/` → `data/assemblies/`
5. ✅ Moved `characters/` → `data/characters/`
6. ✅ Moved `profiles/` → `data/profiles/`
7. ✅ Moved `svg-output/` → `generated/svg-output/`
8. ✅ Updated all import paths in scripts and source files

**Deliverable:** ✅ Consolidated directories, no broken imports

---

#### **Phase 2: Documentation** ✅ (1-2 hours)
1. ✅ Expanded root `README.md` with project overview
2. ✅ Added `docs/CONTRIBUTING.md` for development guidelines
3. ✅ Added `docs/CHANGELOG.md` for version history
4. ✅ Updated `blueprint.md` with final structure

**Deliverable:** ✅ Complete documentation suite

---

#### **Phase 3: Schemas & Validation** ✅ (1-2 hours)
1. ✅ Added JSON schemas for assemblies, profiles, characters, items, archetypes
2. ✅ Created `validate:user-content` script
3. ✅ All generation scripts tested and working
4. ✅ All 5 user content files validated successfully

**Deliverable:** ✅ Schema-validated user content

---

#### **Phase 4: Final Cleanup** ✅ (1 hour)
1. ✅ Renamed `mission-system/` → `mission/` (shorter, consistent)
2. ✅ Added README files to all major directories (9 READMEs)
3. ✅ Updated `blueprint.md` with final structure
4. ✅ Updated mission documentation files with new names
5. ✅ Final git commit

**Deliverable:** ✅ Clean, documented structure

---

### Total Estimated Effort: **4-7 hours**
### Actual Effort: **~5 hours** ✅

### Results
- ✅ 62 files moved/renamed with git history preserved
- ✅ All import paths updated and verified
- ✅ All 823 tests passing
- ✅ Generation scripts tested and working
- ✅ Complete documentation suite added
- ✅ JSON schemas for all user content types
- ✅ Validation script for user content
- ✅ Directory renaming (mission-system → mission)
- ✅ README files for all major modules
- ✅ Mission documentation updated with new names

---

## 17. Current Status

### Completed (Phases 1-2)
- ✅ Spatial awareness system (model registry, LOS, engagement, cover)
- ✅ Mission Side wiring (assemblies, positions, status)
- ✅ Objective Markers system
- ✅ VIP system
- ✅ POI/Zone Control system
- ✅ Reinforcements system
- ✅ Mission Event Hooks
- ✅ 10 of 10 missions implemented (Elimination, Convergence, Assault, Dominion, Recovery, Escort, Triumvirate, Stealth, Defiance, Breach)
- ✅ All 823 unit tests passing
- ✅ Mission/terminology renaming complete
- ✅ Combat traits framework (`combat-traits.ts`) with 43 trait implementations
- ✅ **Directory restructure complete** (191 files organized into 12 modules)
- ✅ **Root directory consolidation complete** (62 files moved/renamed)

### Completed (Phase 3)
- ✅ **JSON schemas** for all user content types (item, archetype, profile, character, assembly)
- ✅ **Validation script** (`npm run validate:user-content`)
- ✅ All user content files validated

### Completed (Phase 4)
- ✅ **Directory rename** `mission-system/` → `mission/`
- ✅ **README files** for all 9 major directories
- ✅ **Mission documentation** updated with new names

### All Restructuring Complete! 🎉

The codebase is now fully organized with:
- Clean module boundaries
- Comprehensive documentation
- Schema-validated user content
- Consistent naming conventions

### Planned
- ⏳ Phase 3A: Minimal Playable UI (8,000–12,000 tokens)
- ⏳ Phase 3B: Full Local Play (15,000–20,000 tokens)
- ⏳ Phase 4: Online Multiplayer Platform (89,000–135,000 tokens)
