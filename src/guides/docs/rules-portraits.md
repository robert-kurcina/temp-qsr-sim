---
title: "Rules: Character Portraits"
dependencies:
status: "In-Progress"
---

## 2D Character Models

A character is represented in the 2D environment with an image and this is its model for use during gameplay.

| Species | Ancestry | Sex | SIZ | File | 
| :--- | :--- | :--- | :--- | :--- | :--- |
| Humaniki | Alef | Akrunai-Auldaran | Male | 3 | portraits/alef-akrunai-auldfaran-male.jpg |
| Humaniki | Alef | Akrunai-Borondan | Male | 3 | portraits/alef-akruniai-borondan-male.jpg |
| Humaniki | Babbita | Indelan | Male | 3 | portraits/babbita-indelan-male.jpg |
| Humaniki | Human | Eniyaski | Male | 3 | portraits/human-eniyaski-male.jpg |
| Humaniki | Human | Quaggkhir | Female | 3 | portraits/human-quaggkhir-female.jpg |
| Humaniki | Human | Quaggkhir | Male | 3 | portraits/human-quaggkhir-male.jpg |
| Humaniki | Human | Vasikhan | Male | 3 | portraits/human-vasikhan-male.jpg |
| Orogulun | Orok | Orogu | Male | 3 | portraits/orugu-common-male.jpg |
| Jhastruj | Jhastra | Jhasu | Male | 2 | portraits/lizardfolk-common-male.jpg |
| Gorblun | Golbrini | Globlin | Male | 2 | portraits/golbrini-common-male.jpg |
| Klobalun | Korkbul | Kolboh | Male | 1 | portraits/kobolds-common-male.jpg |

## Portrait Sheet Layout

Portrait sheets are arranged as 8 columns by 6 rows on a 1920 x 1920 canvas. Each cell is a portrait that can be clipped using a circular mask. The clip anchor is defined by the `clip-example` circle in `portraits/human-quaggkhir-male-example-clip.svg`. Column/row indexing is 0-based (top-left is 0:0).
The default portrait sheet is `portraits/human-quaggkhir-male.jpg` unless otherwise specified.

Clip math (column `c`, row `r`):

```
cellWidth = sheetWidth / 8
cellHeight = sheetHeight / 6
centerX = baseCx + c * cellWidth
centerY = baseCy + r * cellHeight
radius = baseR
```

The anchor values are stored in `src/lib/portraits/portrait-clip.ts`, which exports `getClipMetrics(...)`.

## Demo Generator

Use `npm run generate:portraits` to regenerate `portraits/index.html`. The demo loads the first portrait sheet it finds and lets you change column/row to verify clipping.

## Character Call Signs (Portrait Mapping)

Characters receive a unique name in the format `AA-00` through `ZZ-75`. The first digit maps to the portrait column, and the second digit maps to the portrait row. Example: `BA-32` uses column 3 and row 2. These indices are 0-based.
