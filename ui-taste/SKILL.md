---
name: ui-taste
description: Use when designing, sketching, mocking up, or reviewing the screens of an app, dashboard, admin or ops console, or internal tool, including list and table pages, filters, search, details pages, status colours, logs, and time display. Applies to wireframes, HTML mockups, design canvases, and new front-end UI code. Not for documentation pages or illustrations.
---

# UI taste

## Overview

These are the user's design values for product UIs. They come from the user's review comments on real designs.

**Core principle:** every element must earn its place. A quiet, compact screen that shows each thing once is better than a full screen that shows everything.

This skill sets values, not a theme. A direct request from the user is more important than any rule here.

## Theme: take it from the product

Colours, fonts, radius, and light or dark mode do not come from this skill.

1. Find the product's design tokens: the theme file, the CSS variables, or the component library config.
2. Use those tokens. Do not bring in a different design system.
3. If the product has no theme, ask the user. If you cannot ask, pick a neutral theme and say so.

## Terms

| Term | Meaning |
|---|---|
| Top line | The single header line of a page: title or breadcrumb, page actions, clock and global switches. |
| Quiet control | A small text button with a dotted underline. It takes the accent colour on hover. No fill, no border. |
| Tint | A background tone of the accent colour. It marks the selected item. |
| Context | The text that "Copy context" puts on the clipboard: ids, status, exact error, log query or link. |

## Page recipes

A list page is the top line, the summary cards, and one table. Nothing else.

```
Jobs                         Copy context   Logs ↗          Tue 27 Oct · 09:14   UTC
┌──────────────────────────────────────────────────────┐
│ All jobs 1 204    ◉ Failed 7    ◉ Stuck 2    ◉ Running 3 │   ← a click on a number filters the table
└──────────────────────────────────────────────────────┘
Id ⌕          Status ▾        Customer       Started UTC ↓
3f9c2a71      failed          acme           27 Oct 02:14
8b01d4e2      running         globex         27 Oct 02:10
```

A details page is the top line, one facts card, and one log card. Nothing else.

```
Jobs / 3f9c2a71              Copy context   Logs ↗          Tue 27 Oct · 09:14   UTC
┌───────────────────────────────────────┬──────────────────────┐
│ Status    failed                      │ fetch      done      │
│ Job id    3f9c2a71   ← a click copies │ parse      done      │
│ Type      import                      │ write      failed    │
│ Customer  acme                        │ notify     –         │
│ Started   27 Oct 02:14 UTC            │                      │
└───────────────────────────────────────┴──────────────────────┘
┌ Key lines   Errors and warnings   All ─────────────────────────┐
│  02:14:03  fetch done, 12 400 rows                             │
│▌ 02:15:12  invalid date "31/02" in row 12 401                  │   ← error text, thin left edge
│  ▸ Traceback (38 lines)                                        │   ← a click opens it
└────────────────────────────────────────────────────────────────┘
```

The sections below give the rules behind these recipes.

## 1. Values

1. Minimal. No verbosity. Each element must earn its place. Ask: does the main task of this page fail without it? If no, remove it.
2. Subtle and compact. Use less space for the same job.
3. No "big thumb" design. Secondary things get quiet controls, not large buttons, pills, or segmented controls.
4. Important information goes on the left. Secondary information goes on the right.
5. Show one thing once: one list, one copy button, one log card.
6. Tight scope. Data that another tool already shows does not go here. Put a link to that tool on the top line.
7. Open request: be creative, but stay subtle. Not sure: show two or three variations and let the user pick.

## 2. Colour meaning

The theme gives the colours. The meanings below stay the same in every product.

- The positive colour (usually green) marks a live, healthy state only: running, up.
- A done state (finished, succeeded, delivered) is muted grey, the same as pending and cancelled.
- A neutral or mixed number ("All jobs", "Up 7 / 8") uses the normal text colour.
- The error colour is for failed. The warning colour is for stuck, retrying, or degraded. All other states are muted grey.
- A status in a table is coloured text only: `failed` in the error colour. No dot, no badge, no pill, no filled band.
- The status word carries the meaning, and the colour adds to it. Thus coloured text does not need an icon or a pill for accessibility.
- A status dot is allowed on a summary card, for a coloured state only (failed, stuck, running). Give it a halo ring in a darker tone of the same colour. A grey state gets no dot.
- A selected card or section gets the tint. No accent border.
- Ids, times, and code use the monospace font.

## 3. Top line

- Left: a small muted title, or a breadcrumb such as "Jobs / 3f9c2a71".
- Middle: the page actions, in one place. "Copy context" comes first, then links to other tools ("Logs ↗").
- Right: the clock and the quiet switches, for example the time zone.
- No large page title. No subtitle under a title. No subtitle in a stat tile: "7 failed" needs no sentence.
- Page actions stay on the top line, not inside a card.
- Do not show what the user already knows. Example: the side rail shows the selected environment, so the page does not show it again.
- Do not add a time-range selector or a "Last 24 h" label. Add one only when the user asks.

## 4. Summary cards and lists

- Summary cards at the top are selectors. A click on a number filters the list below.
- Short labels: "Failed", "Stuck". Not "Failed jobs", "Stuck now".
- The list starts directly under the cards. No panel title row.
- One list with filters does the job of many pages. Do not make a "Failed" page and a "Stuck" page.

## 5. Tables

- The first column is the id. The id is a link to the details page.
- Keep few columns. Details go to the details page, not into extra columns or expandable rows.
- An id is more useful than a type. Example: show the instance id, not the instance type.
- Search, filter, and sort live in the column title. No second header row. No search bar, filter chips, or dropdowns above the table.
  - Search: a small magnifier icon. On hover, the title gets the tint. A click opens an input in the title.
  - Filter: a small funnel icon opens a menu. Multi-select. "All" is a single choice and clears the others. The menu closes after each pick.
  - An active filter shows in the title, for example "Status · failed", with an accent border.
  - Sort: a small arrow in the title, for example "Started UTC ↓".
- A date or time filter that the user asks for also lives in the column title of that time column.

## 6. Details pages

- One card with two columns: the facts on the left, a compact secondary list (stages, attempts) on the right.
- Facts are key and value rows. A read-only text box for facts was tried and rejected: "not readable".
- The id is a quiet control. A click copies it.
- No error headline, callout, or banner above the facts. The exact error is in the log and in the context.

## 7. Copy context

Use this when people use the tool to debug problems or to write tickets.

- One "Copy context" button for each page, on the top line. No other copy buttons on the page.
- The context holds the exact error, the ids, and the log query or link. It can go straight into a ticket.
- After a copy, the button shows "Copied" for a short time.

## 8. Logs and long text

- One log card.
- Log views and level filters are text tabs with a thin underline, not pills or chips. Example: "Key lines", "Errors and warnings", "All".
- An error line has error-colour text and a thin left edge in the same colour. No coloured band or fill.
- A long stack trace or body is one line. A click opens it.

## 9. Time

- The clock is one line of small muted text at the top right: "Tue 27 Oct · 09:14". No seconds.
- The time zone switch is a quiet control, for example "UTC" or the local zone.
- Every time on every page follows the switch. Column titles show the zone name: "Started UTC".
- A time that a machine reads (a cron expression) stays in the zone of that machine. GitHub Actions reads cron in UTC.
- When the product has user accounts, the time zone becomes a stored user preference.

## 10. Parts that reviews removed

Agents add these parts by default. The user's reviews and the rules above reject each one. Use the right column instead.

| Do not add | Use instead |
|---|---|
| Large page title, subtitle, description line | A small muted title on the top line |
| A banner that repeats the selected environment | Nothing. The side rail shows it. |
| "Needs attention" or alerts panel | Summary cards that filter the list |
| Charts that nobody asked for | The numbers on the summary cards |
| Panels of other data on the overview | Nothing. The overview has one job. |
| Pages for data that another tool shows | A link to that tool on the top line |
| One page for each status | One list with card filters |
| A search box in the header or above the table | Search in the id column title |
| Filter chips, filter dropdowns, or a date-range picker above a table | Filter in the column title |
| Pills or segmented controls | Text tabs with a thin underline, or quiet controls |
| Status badges, pills, or dots in rows | Coloured status text |
| Status or time as the first column | The id as the first column |
| Expandable table rows | The details page |
| An error banner or callout above the facts | The error line in the log, and the context |
| An error card next to the log card | Error lines marked in the one log card |
| A copy icon next to each value | One "Copy context" on the top line, and the id that copies on click |
| Accent border on the selected card | The tint |
| A read-only text box for facts | Key and value rows |

## Before you show a design

Check each line. Fix each failure, then show the design.

- The page matches its recipe: top line, then cards and one table, or one facts card and one log card.
- Each element passes the test in Values 1.
- Each thing shows once: one list, one copy button, one log card.
- No item from the "Do not add" table, unless the user asked for it.
- The positive colour marks only live, healthy states. Done states are grey.
- Search, filter, and sort live in the column titles.
- The top line holds the title, the page actions, and the clock. Nothing else holds page actions.
- Colours, fonts, and radius come from the product's theme.
