import { readFile, writeFile, access } from 'node:fs/promises';

const API_URL = 'https://api.start.gg/gql/alpha';
const SETS_PER_PAGE = 20;
const STANDINGS_PER_PAGE = 100;
const MINIMUM_MILLISECONDS_BETWEEN_REQUESTS = 800;

const token = process.env.STARTGG_TOKEN;
if (!token) {
  throw new Error('STARTGG_TOKEN is not set. Put STARTGG_TOKEN=<token> in .env (create one at https://start.gg/admin/profile/developer).');
}

const seriesName = process.argv[2] ?? 'chudhouse';
const refetch = process.argv.includes('--refetch');
const series = JSON.parse(await readFile(`series/${seriesName}.json`, 'utf8'));

const EVENT_QUERY = `
query Event($slug: String!) {
  event(slug: $slug) {
    id name startAt numEntrants state
    tournament { name slug }
  }
}`;

const SETS_QUERY = `
query Sets($slug: String!, $page: Int!, $perPage: Int!) {
  event(slug: $slug) {
    sets(page: $page, perPage: $perPage, sortType: CALL_ORDER) {
      pageInfo { totalPages }
      nodes {
        id winnerId displayScore fullRoundText round completedAt
        slots {
          entrant { id participants { player { id gamerTag } } }
          standing { stats { score { value } } }
        }
        games { selections { entrant { id } character { name } } }
      }
    }
  }
}`;

const STANDINGS_QUERY = `
query Standings($slug: String!, $page: Int!, $perPage: Int!) {
  event(slug: $slug) {
    standings(query: { page: $page, perPage: $perPage }) {
      pageInfo { totalPages }
      nodes {
        placement
        entrant { id participants { player { id gamerTag } } }
      }
    }
  }
}`;

let lastRequestTime = 0;

async function graphql(query, variables) {
  const wait = lastRequestTime + MINIMUM_MILLISECONDS_BETWEEN_REQUESTS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestTime = Date.now();

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (!response.ok || body.errors) {
    throw new Error(`start.gg request failed (${response.status}) for ${JSON.stringify(variables)}: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.data;
}

async function fetchAllPages(query, slug, perPage, connectionName) {
  const nodes = [];
  for (let page = 1; ; page++) {
    const data = await graphql(query, { slug, page, perPage });
    if (!data.event) throw new Error(`Event not found: ${slug}`);
    const connection = data.event[connectionName];
    nodes.push(...connection.nodes);
    if (page >= connection.pageInfo.totalPages) return nodes;
  }
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

for (const { slug } of series.events) {
  const outputPath = `data/raw/${slug.split('/')[1]}.json`;
  if (!refetch && (await fileExists(outputPath))) {
    console.log(`cached   ${slug}`);
    continue;
  }

  const { event } = await graphql(EVENT_QUERY, { slug });
  if (!event) throw new Error(`Event not found: ${slug}`);
  const sets = await fetchAllPages(SETS_QUERY, slug, SETS_PER_PAGE, 'sets');
  const standings = await fetchAllPages(STANDINGS_QUERY, slug, STANDINGS_PER_PAGE, 'standings');

  await writeFile(outputPath, JSON.stringify({ slug, event, sets, standings }, null, 2));
  console.log(`fetched  ${slug}  (${event.numEntrants} entrants, ${sets.length} sets)`);
}
