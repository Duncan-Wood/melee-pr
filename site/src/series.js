export const SERIES = [
  { id: 'chudhouse', name: 'CHUD HOUSE', description: 'Mississippi house series, 2025–26', load: () => import('../../data/chudhouse.json') },
  { id: 'scss', name: 'SCSS', description: 'SkyClaw Slippi Sundays, netplay 2021–23', load: () => import('../../data/scss.json') },
];

export const DEFAULT_SERIES_ID = SERIES[0].id;
export const seriesById = (id) => SERIES.find((series) => series.id === id);
