import chudhouse from '../../series/chudhouse.json' with { type: 'json' };
import scssEast from '../../series/scss-east.json' with { type: 'json' };
import scssWest from '../../series/scss-west.json' with { type: 'json' };

const LOBSTER_ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦞</text></svg>";
const skyClawIcon = (coast) => `icons/skyclaw-${coast}.png`;

function withSeriesConfig(id, config, data) {
  const configBySlug = new Map(config.events.map((event) => [event.slug, event]));
  const stale = data.events.length !== config.events.length || data.events.some((event) => !configBySlug.has(event.slug));
  if (stale) throw new Error(`data/${id}.json doesn't match series/${id}.json; run npm run build -- ${id}`);
  return {
    ...data,
    name: config.name,
    defaults: config.defaults ?? {},
    events: data.events.map((event) => ({ ...event, countsForPR: configBySlug.get(event.slug).countsForPR, note: configBySlug.get(event.slug).note ?? null })),
  };
}

const series = (id, config, settings, loadData) => ({
  id,
  name: config.name,
  ...settings,
  load: () => loadData().then((module) => withSeriesConfig(id, config, module.default)),
});

export const SERIES = [
  series('chudhouse', chudhouse, { theme: 'chudhouse', icon: LOBSTER_ICON, description: 'Mississippi house series, 2025–26' }, () => import('../../data/chudhouse.json')),
  series('scss-east', scssEast, { theme: 'scss-east', icon: skyClawIcon('east'), description: 'SkyClaw Slippi Sundays, 7:30 PM ET, 2020–23' }, () => import('../../data/scss-east.json')),
  series('scss-west', scssWest, { theme: 'scss-west', icon: skyClawIcon('west'), description: 'SkyClaw Slippi Sundays, 5:30 PM PT, 2021–23' }, () => import('../../data/scss-west.json')),
];

export const DEFAULT_SERIES_ID = SERIES[0].id;
export const seriesById = (id) => SERIES.find((candidate) => candidate.id === id);
