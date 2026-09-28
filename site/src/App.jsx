import { useEffect, useMemo, useState } from 'react';
import data from '../../data/chudhouse.json';
import { computeRankings, DEFAULT_OPTIONS } from '../../lib/rankings.mjs';
import Countdown from './Countdown.jsx';
import Rankings from './Rankings.jsx';
import Player from './Player.jsx';
import HeadToHead from './HeadToHead.jsx';
import Events from './Events.jsx';

const SETTINGS_KEY = 'melee-pr:chudhouse:settings';

const defaultSettings = () => ({
  algorithm: DEFAULT_OPTIONS.algorithm,
  minimumEvents: DEFAULT_OPTIONS.minimumEvents,
  conservativeDeviations: DEFAULT_OPTIONS.conservativeDeviations,
  includedEventSlugs: data.events.filter((event) => event.countsForPR).map((event) => event.slug),
});

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return saved ? { ...defaultSettings(), ...saved } : defaultSettings();
  } catch {
    return defaultSettings();
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
  const [page = '', parameter] = hash.replace(/^#\/?/, '').split('/');
  return { page, parameter };
}

const NAVIGATION = [
  { page: '', label: 'Countdown' },
  { page: 'rankings', label: 'Rankings' },
  { page: 'head-to-head', label: 'Head-to-head' },
  { page: 'events', label: 'Events' },
];

export default function App() {
  const { page, parameter } = useRoute();
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const results = useMemo(() => computeRankings(data, settings), [settings]);
  const shared = { data, results, settings, setSettings, resetSettings: () => setSettings(defaultSettings()) };
  const currentPage = page === 'player' ? 'rankings' : page;

  return (
    <>
      <header className="masthead">
        <a className="wordmark" href="#/">
          CHUD HOUSE
          <span className="wordmark-sub">Power Rankings</span>
        </a>
        <nav aria-label="Sections">
          {NAVIGATION.map((item) => (
            <a key={item.page} href={`#/${item.page}`} aria-current={currentPage === item.page ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        {page === '' && <Countdown {...shared} />}
        {page === 'rankings' && <Rankings {...shared} />}
        {page === 'player' && <Player {...shared} playerId={parameter} />}
        {page === 'head-to-head' && <HeadToHead {...shared} />}
        {page === 'events' && <Events {...shared} />}
      </main>
    </>
  );
}
