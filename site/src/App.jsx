import { useEffect, useMemo, useRef, useState } from 'react';
import { computeRankings, DEFAULT_OPTIONS } from '../../lib/rankings.mjs';
import { SERIES, DEFAULT_SERIES_ID, seriesById } from './series.js';
import Countdown from './Countdown.jsx';
import Rankings from './Rankings.jsx';
import Player from './Player.jsx';
import HeadToHead from './HeadToHead.jsx';
import Events from './Events.jsx';

const settingsKey = (seriesId) => `melee-pr:${seriesId}:settings`;

const defaultSettings = (data) => ({
  algorithm: DEFAULT_OPTIONS.algorithm,
  minimumEvents: DEFAULT_OPTIONS.minimumEvents,
  conservativeDeviations: DEFAULT_OPTIONS.conservativeDeviations,
  ...data.defaults,
  includedEventSlugs: data.events.filter((event) => event.countsForPR).map((event) => event.slug),
});

function loadSettings(seriesId, data) {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey(seriesId)));
    return saved ? { ...defaultSettings(data), ...saved } : defaultSettings(data);
  } catch {
    return defaultSettings(data);
  }
}

function useRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const segments = hash.replace(/^#\/?/, '').split('/');
  const seriesId = seriesById(segments[0]) ? segments.shift() : DEFAULT_SERIES_ID;
  const [page = '', parameter] = segments;
  return { seriesId, page, parameter };
}

function useSeriesData(seriesId) {
  const [loaded, setLoaded] = useState({});
  useEffect(() => {
    if (loaded[seriesId]) return;
    seriesById(seriesId)
      .load()
      .then((module) => setLoaded((current) => ({ ...current, [seriesId]: module.default })));
  }, [seriesId, loaded]);
  return loaded[seriesId];
}

const NAVIGATION = [
  { page: '', label: 'Countdown' },
  { page: 'rankings', label: 'Rankings' },
  { page: 'head-to-head', label: 'Head-to-head' },
  { page: 'events', label: 'Events' },
];

function SeriesSwitcher({ current, page }) {
  const [open, setOpen] = useState(false);
  const container = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !container.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const samePage = page === 'player' ? 'rankings' : page;
  return (
    <div className="series-switcher" ref={container}>
      <button className="wordmark" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
        {current.name}
        <span className="wordmark-sub">Power Rankings</span>
        <span className="wordmark-caret" aria-hidden="true">▼</span>
      </button>
      {open && (
        <ul className="series-menu" aria-label="Switch series">
          {SERIES.map((series) => (
            <li key={series.id}>
              <a href={`#/${series.id}/${samePage}`} aria-current={series.id === current.id} onClick={() => setOpen(false)}>
                <span className={`series-swatch series-swatch-${series.id}`} aria-hidden="true" />
                <strong>{series.name}</strong>
                <small>{series.description}</small>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SeriesPages({ seriesId, data, page, parameter }) {
  const [settings, setSettings] = useState(() => loadSettings(seriesId, data));

  useEffect(() => {
    try {
      localStorage.setItem(settingsKey(seriesId), JSON.stringify(settings));
    } catch {}
  }, [seriesId, settings]);

  const results = useMemo(() => computeRankings(data, settings), [data, settings]);
  const shared = { data, results, settings, setSettings, resetSettings: () => setSettings(defaultSettings(data)), base: `#/${seriesId}` };

  return (
    <>
      {page === '' && <Countdown {...shared} />}
      {page === 'rankings' && <Rankings {...shared} />}
      {page === 'player' && <Player {...shared} playerId={parameter} />}
      {page === 'head-to-head' && <HeadToHead {...shared} />}
      {page === 'events' && <Events {...shared} />}
    </>
  );
}

export default function App() {
  const { seriesId, page, parameter } = useRoute();
  const series = seriesById(seriesId);
  const data = useSeriesData(seriesId);
  const currentPage = page === 'player' ? 'rankings' : page;

  useEffect(() => {
    document.documentElement.dataset.series = seriesId;
    document.title = `${series.name} Power Rankings`;
  }, [seriesId, series]);

  return (
    <>
      <header className="masthead">
        <SeriesSwitcher current={series} page={page} />
        <nav aria-label="Sections">
          {NAVIGATION.map((item) => (
            <a key={item.page} href={`#/${seriesId}/${item.page}`} aria-current={currentPage === item.page ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        {data ? (
          <SeriesPages key={seriesId} seriesId={seriesId} data={data} page={page} parameter={parameter} />
        ) : (
          <p className="loading">Loading {series.name}…</p>
        )}
      </main>
    </>
  );
}
