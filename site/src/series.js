export const SERIES = [
  { id: 'chudhouse', theme: 'chudhouse', name: 'CHUD HOUSE', description: 'Mississippi house series, 2025–26', load: () => import('../../data/chudhouse.json') },
  { id: 'scss-east', theme: 'scss', name: 'SCSS East Coast', description: 'SkyClaw Slippi Sundays, 7:30 PM ET, 2021–23', load: () => import('../../data/scss-east.json') },
  { id: 'scss-west', theme: 'scss', name: 'SCSS West Coast', description: 'SkyClaw Slippi Sundays, 5:30 PM PT, 2021–23', load: () => import('../../data/scss-west.json') },
];

export const DEFAULT_SERIES_ID = SERIES[0].id;
export const seriesById = (id) => SERIES.find((series) => series.id === id);
