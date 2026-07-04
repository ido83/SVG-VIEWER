import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatSize } from "./api.js";
import UploadZone from "./components/UploadZone.jsx";
import SvgCard from "./components/SvgCard.jsx";

export default function App() {
  const [svgs, setSvgs] = useState([]);
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(async () => {
    setSvgs(await api.list());
  }, []);

  useEffect(() => {
    refresh().catch((e) => setNotice(e.message));
  }, [refresh]);

  const allTags = useMemo(() => {
    const counts = {};
    for (const s of svgs) for (const t of s.tags) counts[t] = (counts[t] || 0) + 1;
    return Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [svgs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return svgs.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q));
      const matchesTags = activeTags.every((t) => s.tags.includes(t));
      return matchesQuery && matchesTags;
    });
  }, [svgs, query, activeTags]);

  const totalSize = useMemo(
    () => visible.reduce((sum, s) => sum + s.size, 0),
    [visible]
  );

  const toggleTag = (tag) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const handleUpload = async (files, tags) => {
    setBusy(true);
    setNotice(null);
    try {
      const { created, rejected } = await api.upload(files, tags);
      if (rejected?.length)
        setNotice(`Skipped (not valid SVG): ${rejected.join(", ")}`);
      if (created?.length) await refresh();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    await api.remove(id);
    setSvgs((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdate = (updated) =>
    setSvgs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <svg viewBox="0 0 32 32" className="brand-mark" aria-hidden="true">
              <path
                d="M4 8 L16 26 L28 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="square"
              />
              <circle cx="4" cy="8" r="3" fill="currentColor" />
              <circle cx="28" cy="8" r="3" fill="currentColor" />
              <circle cx="16" cy="26" r="3" fill="currentColor" />
            </svg>
            <div>
              <h1>Vectorbench</h1>
              <p className="brand-sub">SVG viewer &amp; library</p>
            </div>
          </div>
          <div className="stats">
            <span className="stat">
              <strong>{visible.length}</strong> / {svgs.length} files
            </span>
            <span className="stat">
              <strong>{formatSize(totalSize)}</strong> shown
            </span>
          </div>
        </div>
      </header>

      <main className="content">
        <UploadZone onUpload={handleUpload} busy={busy} />

        {notice && (
          <div className="notice" role="status">
            {notice}
            <button className="notice-close" onClick={() => setNotice(null)}>
              ×
            </button>
          </div>
        )}

        <div className="toolbar">
          <input
            type="search"
            className="search"
            placeholder="Search by name or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search SVGs"
          />
          {(query || activeTags.length > 0) && (
            <button
              className="btn btn-sm"
              onClick={() => {
                setQuery("");
                setActiveTags([]);
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {allTags.length > 0 && (
          <div className="tag-bar" aria-label="Filter by tag">
            {allTags.map(({ tag, count }) => (
              <button
                key={tag}
                className={`tag tag-filter ${
                  activeTags.includes(tag) ? "is-active" : ""
                }`}
                onClick={() => toggleTag(tag)}
              >
                {tag} <span className="tag-count">{count}</span>
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="empty">
            {svgs.length === 0
              ? "The bench is empty. Drop an SVG above to get started."
              : "No files match the current filters. Try clearing them."}
          </div>
        ) : (
          <div className="grid">
            {visible.map((item) => (
              <SvgCard
                key={item.id}
                item={item}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onTagClick={toggleTag}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        Files are stored in the <code>svg_data</code> Docker volume.
      </footer>
    </div>
  );
}
