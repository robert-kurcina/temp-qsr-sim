---
title: "Rules: Overrides"
description: "Temporary rules overrides that supersede legacy source instructions in docs/*.txt."
status: "Active"
---

## Purpose

This file is the authoritative list of **approved rules overrides**.

When an override here conflicts with `docs/*.txt`, this file takes precedence until the source text is updated.

## Override Precedence

Use this precedence order when implementing or validating rules:

1. `src/guides/docs/rules-overrides.md` (highest priority)
2. `src/guides/docs/rules*.md`
3. `docs/*.txt` (legacy source instructions)

---

## OVR-001: Wait Action (Revised)

Status: **Active**

### Acquisition

- Cost: **2 AP**
- Requirement: character must be **not Outnumbered** when acquiring Wait
- Effect: gain **Wait** status and marker

### Start Of Next Initiative

- Wait upkeep is resolved at the start of the character's next Initiative, after AP is set and Delay upkeep is paid.
- If character is **Free**, Wait is maintained at **0 AP**.
- If character is **not Free**, the character may pay **1 AP** to maintain Wait.
- If the character cannot pay, or does not pay, Wait is removed.

### Delay Interaction

- Delay tokens are paid first at **1 AP per token**.
- Remaining AP (if any) is then used for Wait upkeep when not Free.

### React Utility

- While in Wait, character may remove Wait to perform **React**, including while in **Done** status
- While in Wait, effective Visibility OR is doubled for React/Wait sensing windows

### Hidden-Reveal Utility

- While in Wait, hidden opposing models that are:
  - in LOS,
  - not in Cover,
  - and inside current Wait visibility window
  are immediately revealed
