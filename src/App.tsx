import { useEffect, useMemo, useRef, useState } from "react";
import type { Track, TrackListResponse, TrackSource } from "../shared/types";
import { downloadTrack, fetchTracks } from "./api";
import "./styles.css";

const EMPTY: TrackListResponse = {
  tracks: [], facets: { sceneries: [], types: [] }, page: 1, limit: 50,
  total: 0, pages: 1, lastSyncAt: null,
};

function dateLabel(value: string): string {
  if (!value) return "Unknown";
  const date = new Date(value.replace(" ", "T") + "Z");
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(undefined, {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date);
}

function ratingLabel(track: Track): string {
  return track.ratingCount ? `${track.rating.toFixed(2)} / 5` : "Unrated";
}

function typeFilterLabel(tracks: Track[], type: number, source: TrackSource): string {
  if (source === "official") return `Type ${type}`;
  const match = tracks.find((track) => track.source === "community" && track.type === type);
  return match?.source === "community" ? match.typeLabel : `Type ${type}`;
}

function DetailPanel({ track, onClose }: { track: Track; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  async function startDownload() {
    setDownloading(true); setError("");
    try { await downloadTrack(track.source, track.id, track.name); }
    catch (value) { setError(value instanceof Error ? value.message : "The track could not be downloaded."); }
    finally { setDownloading(false); }
  }

  return <div className="panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div className="panel-rule" />
      <header className="panel-head">
        <span className="eyebrow">{track.source} track inspection / #{track.id}</span>
        <button className="close-button" onClick={onClose} ref={closeRef} aria-label="Close details">×</button>
      </header>
      <h2 id="detail-title">{track.name}</h2>
      <p className="scene-title">{track.sceneName}</p>
      <dl className="telemetry-grid">
        <div><dt>Online ID</dt><dd>{track.id}</dd></div>
        {track.source === "official"
          ? <div><dt>Version</dt><dd>V{track.version}</dd></div>
          : <div><dt>Pilot</dt><dd>{track.creator || "Unknown"}</dd></div>}
        <div><dt>Track type</dt><dd>{track.source === "community" ? track.typeLabel : `Type ${track.type}`}</dd></div>
        <div><dt>Published</dt><dd>{dateLabel(track.publishedAt)}</dd></div>
        <div><dt>Rating</dt><dd>{ratingLabel(track)}</dd></div>
        <div><dt>Ratings</dt><dd>{track.ratingCount.toLocaleString()}</dd></div>
      </dl>
      {error && <p className="download-error" role="alert">{error}</p>}
      <button className="download-button" disabled={downloading || !track.downloadAvailable} onClick={startDownload}>
        <span>{downloading ? "Requesting track…" : track.downloadAvailable ? "Download .trk" : "Download unavailable"}</span>
        <span aria-hidden="true">↓</span>
      </button>
      <p className="source-note">{track.source === "community"
        ? "Packed into an import-ready .trk from VelociDrone's live community directory. This site does not retain a copy."
        : "Requested live from VelociDrone. This directory does not retain a copy."}</p>
    </aside>
  </div>;
}

function Skeleton() {
  return <div className="skeleton" aria-label="Loading tracks">
    {Array.from({ length: 8 }, (_, index) => <div className="skeleton-row" key={index}><i /><span /><b /></div>)}
  </div>;
}

export default function App() {
  const [source, setSource] = useState<TrackSource>("official");
  const [query, setQuery] = useState("");
  const [creator, setCreator] = useState("");
  const [debouncedCreator, setDebouncedCreator] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [scenery, setScenery] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Track | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedCreator(creator); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [creator]);

  const params = useMemo(() => {
    const value = new URLSearchParams({ page: String(page), limit: "50", sort });
    if (debouncedQuery) value.set("q", debouncedQuery);
    if (source === "community" && debouncedCreator) value.set("creator", debouncedCreator);
    if (scenery) value.set("scenery", scenery);
    if (type) value.set("type", type);
    return value;
  }, [debouncedQuery, debouncedCreator, scenery, source, type, sort, page]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetchTracks(source, params, controller.signal).then(setData).catch((value) => {
      if (value instanceof DOMException && value.name === "AbortError") return;
      setError(value instanceof Error ? value.message : "The track board could not be loaded.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [params, source]);

  function changeSource(next: TrackSource) {
    if (next === source) return;
    setSource(next);
    setScenery("");
    setType("");
    setSort("newest");
    setPage(1);
    setSelected(null);
    setData(EMPTY);
  }

  function changeFilter(setter: (value: string) => void, value: string) { setter(value); setPage(1); }
  const first = data.total ? (data.page - 1) * data.limit + 1 : 0;
  const last = Math.min(data.total, data.page * data.limit);

  return <div className={`app app-${source}`}>
    <header className="site-header">
      <a className="mark" href="/" aria-label="VDRONE Track Downloader home"><span>VDRONE</span><b>TRACK DOWNLOADER</b></a>
      <div className="live-indicator"><i /> {source === "community" ? "COMMUNITY FEED" : "OFFICIAL FEED"}</div>
    </header>
    <main>
      <section className="search-deck">
        <div className="deck-copy">
          <p className="eyebrow">{source === "community" ? "Pilot-built track directory" : "Official track directory"} / Unofficial interface</p>
          <h1>VDRONE <em>Track Downloader</em></h1>
          <div className="source-switch" role="group" aria-label="Track source">
            <button className={source === "official" ? "active" : ""} aria-pressed={source === "official"} onClick={() => changeSource("official")}>Official</button>
            <button className={source === "community" ? "active" : ""} aria-pressed={source === "community"} onClick={() => changeSource("community")}>Community</button>
          </div>
        </div>
        <label className="search-box">
          <span>{source === "community" ? "Search community track name" : "Search track, scenery or online ID"}</span>
          <div><i aria-hidden="true">⌕</i><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={source === "community" ? "Try race, freestyle or cinematic" : "Try DynamicWeather or 2131"} autoFocus /><kbd>SEARCH</kbd></div>
        </label>
      </section>

      <section className={`control-bar ${source === "community" ? "community-controls" : ""}`} aria-label="Track filters">
        <div className="result-count"><strong>{data.total.toLocaleString()}</strong><span>tracks on board</span></div>
        {source === "community" && <label><span>Pilot</span><input value={creator} onChange={(e) => changeFilter(setCreator, e.target.value)} placeholder="Creator name" /></label>}
        <label><span>Scenery</span><select value={scenery} onChange={(e) => changeFilter(setScenery, e.target.value)}><option value="">All sceneries</option>{data.facets.sceneries.map((item) => <option key={`${item.id ?? item.name}`} value={item.id ?? item.name}>{item.name} ({item.count})</option>)}</select></label>
        <label><span>Type</span><select value={type} onChange={(e) => changeFilter(setType, e.target.value)}><option value="">All types</option>{data.facets.types.map((item) => <option key={item.type} value={item.type}>{typeFilterLabel(data.tracks, item.type, source)} ({item.count})</option>)}</select></label>
        <label><span>Order</span><select value={sort} onChange={(e) => changeFilter(setSort, e.target.value)}><option value="newest">Newest first</option>{source === "official" && <><option value="oldest">Oldest first</option><option value="name">Track name</option></>}<option value="rating">Highest rated</option>{source === "official" && <option value="popularity">Most rated</option>}</select></label>
      </section>

      {source === "community" && data.resultLimitReached && <p className="feed-note" role="status">VelociDrone returns up to 200 community matches. Use track, pilot, scenery, or class filters to narrow the board.</p>}

      <section className="board" aria-live="polite">
        <div className="board-head"><span>ID</span><span>Track / scenery</span><span>Type</span><span>{source === "community" ? "Pilot" : "Version"}</span><span>Rating</span><span>Published</span><span /></div>
        {loading ? <Skeleton /> : error ? <div className="board-message error"><h2>Feed interrupted</h2><p>{error}</p><button onClick={() => location.reload()}>Reload board</button></div> : data.tracks.length === 0 ? <div className="board-message"><h2>No tracks on this line</h2><p>Clear a filter or try a shorter track name.</p></div> : <div className="track-list">
          {data.tracks.map((track) => <button className="track-row" key={track.id} onClick={() => setSelected(track)}>
            <span className="track-id">{String(track.id).padStart(4, "0")}</span>
            <span className="track-name"><strong>{track.name}</strong><small>{track.sceneName}</small></span>
            <span data-label="Type">{track.source === "community" ? track.typeLabel : `T${track.type}`}</span><span className="pilot-cell" data-label={track.source === "community" ? "Pilot" : "Version"}>{track.source === "community" ? track.creator : `V${track.version}`}</span>
            <span className="rating" data-label="Rating">{track.ratingCount ? track.rating.toFixed(2) : "—"}<small>{track.ratingCount ? `${track.ratingCount} votes` : "unrated"}</small></span>
            <span data-label="Published">{dateLabel(track.publishedAt)}</span><span className="inspect">VIEW <b>→</b></span>
          </button>)}
        </div>}
      </section>

      <nav className="pagination" aria-label="Track pages">
        <span>Showing {first}–{last}</span>
        <div><button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>← Previous</button><b>{data.page} / {data.pages}</b><button disabled={page >= data.pages || loading} onClick={() => setPage((p) => p + 1)}>Next →</button></div>
      </nav>
    </main>
    <footer><span>VDRONE TRACK DOWNLOADER</span><p>Tracks and metadata are served from VelociDrone. Not affiliated with Bat Cave Games.</p><time>{data.lastSyncAt ? `Feed checked ${dateLabel(data.lastSyncAt)}` : "Awaiting feed sync"}</time></footer>
    {selected && <DetailPanel track={selected} onClose={() => setSelected(null)} />}
  </div>;
}
