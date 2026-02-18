# MEST Tactics Simulator
A tabletop wargame simulator for the MEST Tactics game rules.

## Overview
This is written by several AI engines such as Qwen3-Max, Gemini, Co-pilot, and ChatGPT-Codex 5.2. It is a project to see if a Web game can be created using AI. 

## Features
Here are the implemented features of this project:

1. Builds headless 2D SVG Battlefields per Mission specification
2. Creates Sides containing Assemblies of Characters from Profiles and Archetypes

## Planned Features
These are near-term features:

1. Output 2D SVG of Battlefield
2. Present game within a Web page as a full-stack front-end application
3. Interact with the Web app

These are long-term features:

1. Zero or more players can be non-LLM AI bots
2. Allow multiple players
3. Present game in 3D

## SVG Output

Generate the battlefield SVGs (and `svg-output/index.html`):

```bash
npm run generate:svg
```
