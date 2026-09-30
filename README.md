# melee-pr

Power rankings for Super Smash Bros. Melee tournament series, built from every set on start.gg. It gives a PR panel real numbers to start from; it doesn't make the final call.

Live at https://duncan-wood.github.io/melee-pr/

## How the ranking works

The ranking uses [Whole-History Rating](https://www.remi-coulom.fr/WHR/WHR.pdf) (Coulom, 2008), fit to every completed set in the counted events. DQs and byes are dropped.

- **Win chances.** Each player has a skill rating. A player rated 200 points higher is expected to win about 76% of their sets, and 400 points higher about 91%. This is the same curve Elo and Glicko use (a Bradley–Terry model).
- **Hindsight.** All sets are fit together, so a win counts for how strong the opponent turned out to be, not how they were rated that day. Beating a newcomer who later became a top player counts as beating a top player.
- **Skill changes over time, slowly.** A player's rating can drift between events, by about 95 points a year on average. So recent results count a little more than old ones, and the backtest below measures how much.
- **New players.** Everyone starts near 1500. A light prior (a quarter of a win and a quarter of a loss against a 1500 player) keeps someone with a few sets from getting an extreme rating.
- **Uncertainty.** Each rating has an uncertainty (±) from how much evidence backs it. It's smaller for players who've had many sets against well-known opponents, and it grows while a player is away.
- **The order.** Players are sorted by **PR score = rating − 2 × uncertainty**, so a rating backed by many events beats one hot run. Each series sets how many counted events a player needs to be ranked: 4 for CHUD HOUSE and 10 for the SCSS series.

The dashboard can change the rating system (Whole-History, Glicko-2, or Elo), minimum events, attendance weight, and which events count. Each player's page explains their rank, including the results that moved it most.

### Why this method

The method was chosen by how well it predicts real results, not by how any particular ranking looks. `scripts/evaluate.mjs` replays each series in order. Before every event, it rates players using only earlier events, then scores its predicted win chance for each set there, using log loss (lower is better; a coin flip scores 0.693). Sets involving a player's first event are skipped.

It ran on 14,278 sets across 8 series: CHUD HOUSE and both SCSS series, plus five test-only series from other scenes, in `series/eval/`. Those are the Starkville weeklies (MS), Reesch's Tuesdays (MO), Throwdown Thursday (VA), Triple Threat Tuesdays (NJ), and Waddle Wednesday (online).

| Method | Log loss | Compared with Whole-History |
|---|---|---|
| **Whole-History Rating** | **0.4225** | |
| + a head-to-head bonus | 0.4226 | no better (z = 0.3); larger bonuses are worse |
| Whole-History with a stronger prior | 0.4244 | worse (z = 2.6) |
| Bradley–Terry, no change over time | 0.4246 | worse (z = 4.5) |
| Glicko-2 | 0.4491 | worse (z = 13.2), and on each of the 8 series |
| Elo | 0.4895 | worse (z = 23.1) |

The comparisons are paired, set by set, and |z| above 2 means the difference is unlikely to be chance. What this settled:

- **Glicko-2 and Elo** update one event at a time and never revisit a win, and Glicko also lets a player's first events swing their rating the most. Both predict worse everywhere.
- **"Should recent events count more?"** Yes, a little. Allowing slow drift beats a fixed rating, but faster drift doesn't help.
- **"Should head-to-head count extra?"** No. Every head-to-head set is already in the rating, and weighting them extra doesn't improve predictions.

### Limits

- **Neighbors often aren't separable.** Local series are small, and most neighboring ranks are within each other's uncertainty. In the CHUD HOUSE top 20, 16 of 19 neighboring pairs are, so the numbers separate tiers better than they separate #7 from #8.
- **The panel makes the final call.** The ranking is a starting point for the PR panel. Results from events off start.gg, or ones that weren't reported, aren't in it.

## Running it

Requires Node 20.10+ and a [start.gg API token](https://start.gg/admin/profile/developer).

```sh
npm install
echo 'STARTGG_TOKEN=your_token_here' > .env
npm run fetch -- <series>   # download brackets into data/raw/ (cached; add --refetch to redownload)
npm run build -- <series>   # clean them into data/<series>.json
npm run site                # local dashboard
```

Pushing to `main` deploys the dashboard to GitHub Pages. It reads the committed `data/<series>.json`, so deploys don't need the token. Each series also gets a share link, such as `/melee-pr/chudhouse/`, with its own link preview. The preview images are in `site/public/previews/`.

## Adding a series

Create `series/<name>.json`, then add it to `site/src/series.js` with an import and an entry giving its theme, icon, and description:

```json
{
  "name": "My Series",
  "timezone": "America/Chicago",
  "events": [{ "slug": "tournament/<tournament>/event/<event>", "countsForPR": true, "note": "Optional" }],
  "aliases": { "<duplicate start.gg player id>": "<main player id>" },
  "tagOverrides": { "<player id>": "<tag to display>" }
}
```

- `aliases` merges a player who entered under two accounts. `build` fails on anything it can't match, so merges never happen by guessing.
- `characters` (optional) sets a player's character icons, such as `{ "<player id>": ["Fox", "Marth"] }`. Otherwise icons come from start.gg's reported games, where available. Add a costume color for the portrait, like `"Samus (Pink)"`; the available ones are the files in `site/public/portraits/`.
- `countsForPR: false` keeps an event on the dashboard but out of the ranking.
- `defaults` (optional) overrides the dashboard's starting settings, such as `{ "minimumEvents": 10 }`.
- **Player photos:** save a photo as `site/public/photos/<series>/<player id>.jpg` and it replaces that player's character portrait. The player id is at the end of their page's URL. Shrink photos first, e.g. `sips -Z 800 -s formatOptions 80 photo.jpg --out <path>`; the build rejects files over 300 KB.

The site reads `name`, `defaults`, and each event's `note` and `countsForPR` straight from `series/<name>.json`, so editing them doesn't need a rebuild. Changing the event list, `aliases`, `tagOverrides`, or `characters`, or adding a photo, does: run `npm run build -- <series>`. If the event list and the built data disagree, the site shows an error instead of stale results.

## Testing ranking methods

`node scripts/evaluate.mjs` reruns the backtest above for every method and setting, then prints the pooled results, the results for each series, and the paired comparisons. The test-only series in `series/eval/` have to be downloaded once with `npm run fetch -- eval/<name>` and `npm run build -- eval/<name>`. Their data stays out of git. Rerun it before changing the method or its settings (`lib/whr.mjs`, and `DEFAULT_OPTIONS` in `lib/rankings.mjs`).
