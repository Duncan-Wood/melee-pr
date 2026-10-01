const METHOD_URL = 'https://github.com/Duncan-Wood/melee-pr#how-the-ranking-works';

export default function HowItWorks({ data, results, settings, base }) {
  const counted = new Set(results.events.map((event) => event.slug));
  const setCount = data.sets.filter((set) => counted.has(set.eventSlug)).length;
  const events = `${results.events.length} ${results.events.length === 1 ? 'bracket' : 'brackets'}`;
  const minimum = `${settings.minimumEvents} counted ${settings.minimumEvents === 1 ? 'event' : 'events'}`;

  return (
    <div className="page">
      <h1 className="page-title">How it works</h1>
      <p className="page-intro">The short version of how these rankings are made. No math required.</p>
      <div className="sheet explainer">
        <section>
          <h2>What this is</h2>
          <p>
            Every set from {events} on start.gg, {setCount.toLocaleString()} sets in all, turned into one ranking. It’s a starting point for whoever decides the
            PR, not the final word.
          </p>
        </section>
        <section>
          <h2>How you move up</h2>
          <p>
            Beat good players. Every win and loss moves your rating, and how much depends on who it was against. A win counts for how good that player turned
            out to be over the whole series, so beating someone before they got good still counts. Losing to someone rated well below you costs the most.
          </p>
          <p>Where you finish in a bracket doesn’t count directly. Only the sets you played to get there do.</p>
        </section>
        <section>
          <h2>Why showing up matters</h2>
          <p>
            The fewer sets you’ve played, the less sure the site is about your rating, so it lowers your score a little to be safe. That’s why one great night
            doesn’t put someone above the regulars.
          </p>
          <p>You also need {minimum} to be ranked at all. Strong players below that are listed under honorable mentions.</p>
        </section>
        <section>
          <h2>Why close ranks are basically ties</h2>
          <p>
            Under each rank is a small range, like 4–8. That’s where the player could reasonably land, given how few sets a local series has. If two players’
            ranges overlap, the numbers can’t really separate them, and it’s fair to argue either way.
          </p>
        </section>
        <section>
          <h2>Why this method</h2>
          <p>
            Several rating systems were tested on about 14,000 real sets from eight series, to see which one best predicted who would win. The site’s
            default, Whole-History Rating, came out ahead on every series.
          </p>
          <p>
            Two things people asked about were tested the same way. Recent events count a little more, because that improved the predictions. Head-to-head
            records don’t get extra weight, because that didn’t.
          </p>
        </section>
        <section>
          <h2>What it can’t see</h2>
          <p>Sets that aren’t on start.gg, and anything that isn’t a set result: friendlies, who was having an off day, who’s been grinding lately.</p>
        </section>
        <section>
          <h2>You can change it</h2>
          <p>
            On the <a href={`${base}/rankings`}>Rankings page</a> you can change the minimum events, how much attendance matters, the rating system, and which
            events count. The list updates right away.
          </p>
        </section>
        <p className="muted">
          Want the math? It’s all in <a href={METHOD_URL}>the write-up on GitHub</a>.
        </p>
      </div>
    </div>
  );
}
