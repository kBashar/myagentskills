---
name: feature-decisions
description: Use when a feature is built and the user wants to tell a product person, PM, or stakeholder what was decided — the final product decisions of an implemented feature, or what changed from the first design.
---

# Feature decisions

## Overview

Turn a built feature into one page of its product decisions. The reader is a product person. They care what the feature does, not how the code does it.

**REQUIRED SUB-SKILL:** use visual-docs to build the page.

## Sources

- **The built code is the truth.** Read the feature's diff against its base branch. Plans, logs and chat explain a decision; the code states it.
- **The first design** (design doc, spec or issue) shows what changed. If the user gave none, ask for it. If none exists, leave out the chips.

## The keep test

An item goes on the page only when all three are true:

1. **It is what, not how.** It says what the built feature lets a user do, see or get. Code names, tables, migrations, algorithms, HTTP methods, error codes, validation and access checks are how.
2. **It is the new feature, now.** Old routes, old data and later work are out.
3. **A product person would not assume it.** "A failed save keeps the old data" is assumed. "The count includes only your own organisation" is not.

State each decision by its effect on the user. Merge items that state one idea.

| How | What |
|---|---|
| The server refuses a body over 10 MB with 413. | A user can upload a file of up to 10 MB. |

Budget: about five decisions per endpoint. More means how or assumed items got through.

## The page

These parts, in this order:

1. **Header** — title, one-line lede, issue or PR numbers, date of the first design.
2. **Terms** — one sentence per product word. Use the product word on the whole page. When the API uses another word, say so in the term.
3. **How it works** — two figures. First, what one main action does to what the user sees. Then the flow, with user, screen and API lanes only.
4. **Decisions**
   - A table of the endpoints: name, route, used by, what it does.
   - One group per endpoint: its route, then its decisions. A feature with no endpoints groups by screen or command.
   - Number the decisions 1, 2, 3 … across the whole page.
   - One or two sentences per decision. Chip it `changed` or `added` when it differs from the first design. The chip is enough; the old rule stays off the page.
   - One sample call per endpoint: request and response JSON, colour-highlighted, in a collapsed `<details>`. Check each sample against the real schemas in the code.
   - A worked example with real numbers goes right after the group it explains.
5. **Sources** — one line: issue or PR numbers and dates.

Write all page text in ASD-STE100 Simplified Technical English.
