# melee-pr

Power rankings for Super Smash Bros. Melee tournament series, built from every set on start.gg. It gives a PR panel real numbers to start from; it doesn't make the final call.

Live at https://duncan-wood.github.io/melee-pr/

## How the ranking works

- Every completed set feeds a [Glicko-2](https://en.wikipedia.org/wiki/Glicko_rating_system) rating, with each tournament as one rating period. Beating a strong player counts for more than beating a new one. DQs and byes are dropped.
- Each rating carries an uncertainty (±) that shrinks as a player attends and grows while they're away.
- Players are sorted by **PR score = rating − 2 × uncertainty**, so a rating backed by many events beats one hot run. Players need 3 counted events to be ranked.
- Every one of these can be changed on the dashboard: rating system (Glicko-2 or Elo), minimum events, attendance weight, and which events count. Each player's page explains their rank.

## Running it

Requires Node 20.6+ and a [start.gg API token](https://start.gg/admin/profile/developer).

```sh
npm install
echo 'STARTGG_TOKEN=your_token_here' > .env
npm run fetch -- <series>   # download brackets into data/raw/ (cached; add --refetch to redownload)
npm run build -- <series>   # clean them into data/<series>.json
npm run site                # local dashboard
```

Pushing to `main` deploys the dashboard to GitHub Pages. It reads the committed `data/<series>.json`, so deploys don't need the token.

## Adding a series

Create `series/<name>.json` and register it in `site/src/series.js`:

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
- `countsForPR: false` keeps an event on the dashboard but out of the ranking.
- `defaults` (optional) overrides the dashboard's starting settings, such as `{ "minimumEvents": 10 }`.
