import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { SERIES, DEFAULT_SERIES_ID, seriesById } from '../site/src/series.js';

const SITE_URL = 'https://duncan-wood.github.io/melee-pr/';
const OUTPUT_DIRECTORY = 'dist';

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function previewTags(series, pageUrl) {
  const title = escapeHtml(`${series.name} Power Rankings`);
  const description = escapeHtml(`Power rankings for ${series.name} (${series.description}), built from every set on start.gg.`);
  return `<meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:image" content="${SITE_URL}previews/${series.id}.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />`;
}

const indexPath = `${OUTPUT_DIRECTORY}/index.html`;
const index = await readFile(indexPath, 'utf8');
if (!index.includes('</head>')) throw new Error(`${indexPath} has no </head> to add preview tags to`);
await writeFile(indexPath, index.replace('</head>', `  ${previewTags(seriesById(DEFAULT_SERIES_ID), SITE_URL)}\n  </head>`));

for (const series of SERIES) {
  const appUrl = `../#/${series.id}/`;
  await mkdir(`${OUTPUT_DIRECTORY}/${series.id}`, { recursive: true });
  await writeFile(
    `${OUTPUT_DIRECTORY}/${series.id}/index.html`,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(series.name)} Power Rankings</title>
    ${previewTags(series, `${SITE_URL}${series.id}/`)}
    <meta http-equiv="refresh" content="0; url=${appUrl}" />
    <script>location.replace('${appUrl}');</script>
  </head>
  <body>
    <a href="${appUrl}">${escapeHtml(series.name)} Power Rankings</a>
  </body>
</html>
`,
  );
}

console.log(`added link previews for ${SERIES.map((series) => `${SITE_URL}${series.id}/`).join(', ')}`);
