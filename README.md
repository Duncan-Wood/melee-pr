# melee-pr

Data-backed power rankings for Super Smash Bros. Melee tournament series, built from start.gg results.

## What it does

A power ranking (PR) is a list of the best players in a scene. Usually a panel argues it out from memory. This project pulls every set from a series' start.gg brackets and gives the panel real numbers to start from:

- **A rating for every player.** Every set won or lost moves it. Beating someone strong moves it a lot, and beating someone new barely moves it.
- **Attendance counts.** Players who show up more have a more certain rating. The ranking favors them over someone who had one hot run.
- **Panel notes.** For each player: set record, best wins, upsets they suffered, and every placement.
- **Head-to-head.** A grid showing who has beaten whom, and how many times.

The numbers are a starting point for the panel, not the final word.

## Series

| Series | Events | Status |
|---|---|---|
| CHUD HOUSE (Mississippi) | 14 (12 count toward the PR) | Dashboard + draft in `output/chudhouse_pr_draft.md` |
| SCSS East Coast (SkyClaw Slippi Sundays, netplay) | 71 singles brackets, 2021–2023, including the earlier "SCSS #33–76" | Dashboard |
| SCSS West Coast (SkyClaw Slippi Sundays, netplay) | 91 singles brackets, 2021–2023 | Dashboard |

## Running it

Requires Node 20.6+ and a start.gg API token (create one at https://start.gg/admin/profile/developer).

```sh
npm install
echo 'STARTGG_TOKEN=your_token_here' > .env
npm run fetch            # downloads brackets into data/raw/ (cached; add -- --refetch to redownload)
npm run build            # cleans them into data/<series>.json
npm run rank             # writes output/<series>_pr_draft.md
```

Every script takes the series name as its first argument and defaults to `chudhouse`, for example `npm run rank -- chudhouse 25` for a top 25.

## Dashboard

`site/` is the shareable version. Click the series name in the header to switch series; each has its own color theme (`:root[data-theme=…]` in `site/src/styles.css`) and is registered in `site/src/series.js`. It has a countdown reveal of the top 10/15/20, a sortable ranking with live settings (rating system, minimum events, attendance weight, which events count), a page per player with every set, a head-to-head grid, and an events timeline with notes from the TO.

```sh
npm run site             # local dev server
npm run site:build       # static build into dist/
```

Pushing to `main` deploys it to GitHub Pages through `.github/workflows/pages.yml`. The site reads the committed `data/<series>.json`, so deploys never need the start.gg token.

## Adding a series

Create `series/<name>.json`:

```json
{
  "name": "My Series",
  "timezone": "America/Chicago",
  "events": [
    { "slug": "tournament/<tournament>/event/<event>", "countsForPR": true }
  ],
  "aliases": { "<duplicate start.gg player id>": "<main player id>" },
  "tagOverrides": { "<player id>": "<tag to display>" }
}
```

- `timezone` is where the events happen, so dates show the local day. Online-only series still need one.
- `defaults` (optional) overrides the dashboard's starting settings, such as `{ "minimumEvents": 10 }` for a long series.
- `note` (optional, per event) is shown on the dashboard's events timeline.
- `slug` is the part of the start.gg event URL after `start.gg/`.
- `countsForPR: false` keeps an event in the data but out of the ranking.
- `aliases` merges a player who entered under two accounts, such as a guest entry and a real account. `build` stops with an error on anything it can't match, so merges never happen by guessing.
- `tagOverrides` sets the name shown for a player.

## How the ranking works

- Every completed set feeds a [Glicko-2](https://en.wikipedia.org/wiki/Glicko_rating_system) rating, with each tournament as one rating period. DQs and byes are dropped.
- Each rating has an uncertainty (±). It shrinks as a player attends and grows while they're away.
- Players are sorted by **rating − 2 × uncertainty**. Only players with at least 3 counted events are ranked. Strong players below that cutoff appear as honorable mentions.
- The ranking math lives in `lib/rankings.mjs` so a dashboard can reuse it.

## Layout

```
series/    which events make up each series, plus player merges
scripts/   fetch → build → rank
lib/       ranking math
data/      raw start.gg responses and cleaned per-series data
output/    generated drafts
```
