"use client";

import {
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LoggedVisit, Show } from "@/lib/shows";

interface Stamp {
  x: number;
  y: number;
  rot: number;
  z: number;
}

const LOCAL_KEY = "limelight.visits";
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function pleatStyle(w: number, h: number, rot: number, rad: number, dir: number): CSSProperties {
  return {
    flexGrow: w, flexBasis: 0, height: h + "%", alignSelf: "flex-start",
    background: `linear-gradient(${dir}deg, oklch(0.57 0.17 28) 0%, oklch(0.48 0.185 28) 34%, oklch(0.36 0.15 27) 64%, oklch(0.5 0.18 28) 90%)`,
    borderBottomLeftRadius: rad + "px", borderBottomRightRadius: rad - 18 + "px",
    transform: `rotate(${rot}deg)`, transformOrigin: "50% 0%",
    boxShadow: "-5px 0 11px rgba(64,26,10,.16)", willChange: "transform",
  };
}

const LEFT: [number, number, number, number, number][] = [
  [1.15, 98, -1.2, 66, 102], [0.9, 90, 0.8, 82, 78], [1.25, 100, -0.6, 56, 104],
  [0.85, 93, 1.4, 90, 80],   [1.1, 96, -1.0, 64, 100], [0.95, 87, 0.5, 76, 82],
];
const RIGHT: [number, number, number, number, number][] = [
  [0.95, 89, 1.0, 80, 80],  [1.2, 96, -0.7, 58, 102], [0.88, 92, 1.3, 88, 78],
  [1.15, 100, -1.1, 62, 104], [0.92, 90, 0.6, 84, 80], [1.22, 97, -1.4, 56, 100],
];
const SWAG_W = [1.1, 0.85, 1.25, 0.95, 1.15, 0.8, 1.2, 0.9, 1.1, 0.86, 1.18];
const SWAG_H = [54, 40, 60, 46, 56, 38, 58, 44, 52, 42, 56];

function scatterPos(i: number): Stamp {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return {
    x: 30 + col * 225 + ((i * 53) % 40) - 20,
    y: 10 + row * 150 + ((i * 31) % 36) - 18,
    rot: (((i * 37) % 17) - 8) * 0.9,
    z: i + 1,
  };
}

function mapsQuery(show: { theatre: string; address: string }): string {
  return encodeURIComponent(`${show.theatre}, ${show.address}`);
}

function formatSeenDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value.toUpperCase();
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${m[3]} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

function parseDisplayDate(d: string): string {
  const M: Record<string, string> = {
    JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",
    JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12",
  };
  const m = /^(\d{2})\s([A-Z]{3})\s(\d{4})$/i.exec(d.trim());
  if (!m) return "";
  const mo = M[m[2].toUpperCase()];
  return mo ? `${m[3]}-${mo}-${m[1]}` : "";
}

function loadLocal(): LoggedVisit[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]"); }
  catch { return []; }
}
function saveLocal(visits: LoggedVisit[]) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(visits)); }
  catch { /* quota */ }
}

export default function TheatreLog({ shows }: { shows: Show[] }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<Show[]>(shows);
  const [selected, setSelected]     = useState<Show | null>(null);

  const [visits, setVisits]               = useState<LoggedVisit[]>([]);
  const [dbConfigured, setDbConfigured]   = useState<boolean | null>(null);
  const [stamps, setStamps]               = useState<Record<string, Stamp>>({});
  const [expandedVisit, setExpandedVisit] = useState<LoggedVisit | null>(null);

  // ---- load visits ----
  useEffect(() => {
    let alive = true;
    fetch("/api/logs")
      .then(r => r.json())
      .then((d: { configured: boolean; visits: LoggedVisit[] }) => {
        if (!alive) return;
        if (d.configured) { setDbConfigured(true); setVisits(d.visits ?? []); }
        else               { setDbConfigured(false); setVisits(loadLocal()); }
      })
      .catch(() => { if (!alive) return; setDbConfigured(false); setVisits(loadLocal()); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setStamps(prev => {
      const next = { ...prev };
      visits.forEach((v, i) => { if (!next[v.id]) next[v.id] = scatterPos(i); });
      return next;
    });
  }, [visits]);

  // ---- curtain animation ----
  const pleatsRef  = useRef<HTMLDivElement[]>([]);
  const centersRef = useRef<number[]>([]);
  const rotsRef    = useRef<number[]>([]);
  const mx = useRef(0), tx = useRef(0), t0 = useRef(0);

  const setPleat = (i: number) => (el: HTMLDivElement | null) => { if (el) pleatsRef.current[i] = el; };
  const measure  = useCallback(() => {
    centersRef.current = pleatsRef.current.map(el => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; });
  }, []);

  useEffect(() => {
    rotsRef.current = [...LEFT, ...RIGHT].map(p => p[2]);
    mx.current = tx.current = window.innerWidth / 2;
    t0.current = performance.now();
    measure();
    const onMouse  = (e: MouseEvent) => (tx.current = e.clientX);
    const onResize = () => measure();
    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("resize", onResize);
    let raf = 0;
    const loop = (now: number) => {
      const t = now - t0.current, W = window.innerWidth;
      mx.current += (tx.current - mx.current) * 0.09;
      const m = mx.current, pl = pleatsRef.current;
      for (let i = 0; i < pl.length; i++) {
        const el = pl[i]; if (!el) continue;
        const cx = centersRef.current[i] ?? W / 2, rot = rotsRef.current[i] ?? 0, phase = i * 0.5;
        const idle = Math.sin(t * 0.0011 + phase) * 3;
        const infl = Math.exp(-((m - cx) ** 2) / (W * W * 0.13));
        const sway = idle + (m - cx) * 0.014 * infl;
        const breathe = 1 + 0.009 * Math.sin(t * 0.0011 + phase);
        el.style.transform = `rotate(${rot}deg) translateX(${sway.toFixed(2)}px) skewX(${(sway * 0.035).toFixed(3)}deg) scaleY(${breathe.toFixed(4)})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("mousemove", onMouse); window.removeEventListener("resize", onResize); cancelAnimationFrame(raf); };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (expandedVisit) setExpandedVisit(null);
      else if (selected)  setSelected(null);
      else if (searchOpen) setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedVisit, selected, searchOpen]);

  // ---- dragging + tap-to-expand ----
  const drag = useRef<{ id: string; sx: number; sy: number; x0: number; y0: number; moved: boolean } | null>(null);

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (!d.moved) return;
    setStamps(s => ({ ...s, [d.id]: { ...s[d.id], x: d.x0 + dx, y: d.y0 + dy } }));
  }, []);

  const onUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (d && !d.moved) {
      // tap: find the visit and open it expanded
      setVisits(v => { const visit = v.find(x => x.id === d.id); if (visit) setExpandedVisit(visit); return v; });
    }
  }, [onMove]);

  const onDown = (id: string) => (e: ReactPointerEvent) => {
    e.preventDefault();
    const st = stamps[id]; if (!st) return;
    drag.current = { id, sx: e.clientX, sy: e.clientY, x0: st.x, y0: st.y, moved: false };
    setStamps(s => { const mz = Math.max(0, ...Object.values(s).map(v => v.z)); return { ...s, [id]: { ...s[id], z: mz + 1 } }; });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ---- search ----
  useEffect(() => {
    if (!searchOpen) return;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then(r => r.json()).then((d: { results: Show[] }) => setResults(d.results)).catch(() => {});
    }, 120);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [query, searchOpen]);

  // ---- log / edit / remove ----
  const logVisit = useCallback(async (show: Show, theatre: string, dateValue: string, seat: string) => {
    const res  = await fetch("/api/logs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: show.id, theatre, date: formatSeenDate(dateValue), seat }),
    });
    const data: { configured: boolean; visit?: LoggedVisit; error?: string } = await res.json();
    if (!res.ok || !data.visit) throw new Error(data.error ?? "Could not log visit");
    setVisits(v => { const next = [...v, data.visit as LoggedVisit]; if (!data.configured) saveLocal(next); return next; });
  }, []);

  const editVisit = useCallback(async (id: string, theatre: string, date: string, seat: string) => {
    setVisits(v => {
      const next = v.map(x => x.id === id ? { ...x, theatre, date, seat } : x);
      if (dbConfigured === false) saveLocal(next);
      return next;
    });
    // keep expanded visit state in sync
    setExpandedVisit(ev => ev && ev.id === id ? { ...ev, theatre, date, seat } : ev);
    if (dbConfigured) {
      fetch("/api/logs", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, theatre, date, seat }),
      }).catch(() => {});
    }
  }, [dbConfigured]);

  const removeVisit = useCallback(async (id: string) => {
    setVisits(v => { const next = v.filter(x => x.id !== id); if (dbConfigured === false) saveLocal(next); return next; });
    setExpandedVisit(ev => (ev?.id === id ? null : ev));
    if (dbConfigured) fetch(`/api/logs?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }, [dbConfigured]);

  return (
    <div className="stage">
      <div className="valance">
        <div className="valance-bar"><div className="valance-title">Limelight</div></div>
        <div className="swag-row">
          {SWAG_W.map((w, i) => (
            <div key={i} style={{
              flexGrow: w, flexBasis: 0, height: SWAG_H[i] + "px",
              background: "linear-gradient(180deg, oklch(0.5 0.185 28) 0%, oklch(0.4 0.17 27) 100%)",
              borderBottomLeftRadius: "60% 100%", borderBottomRightRadius: "60% 100%",
              boxShadow: "0 4px 8px rgba(60,24,8,.18)",
            }} />
          ))}
        </div>
      </div>

      <div className="curtain curtain-left">
        {LEFT.map((p, i)  => <div key={i} ref={setPleat(i)} style={pleatStyle(p[0],p[1],p[2],p[3],p[4])} />)}
      </div>
      <div className="curtain curtain-right">
        {RIGHT.map((p, i) => <div key={i} ref={setPleat(LEFT.length + i)} style={pleatStyle(p[0],p[1],p[2],p[3],p[4])} />)}
      </div>
      <div className="curtain-seam" />
      <div className="spotlight" />
      <div className="spotlight-vignette" />

      {visits.length === 0 && (
        <div className="stage-empty">
          <div className="stage-empty-eyebrow">The stage is set</div>
          <div className="stage-empty-title">No tickets stubbed yet</div>
          <p>Search the {shows.length} trending London shows, read a quick overview, and log the ones you&rsquo;ve seen — each becomes a draggable ticket stub here.</p>
          <button className="cta" onClick={() => setSearchOpen(true)}>Search the repertoire</button>
        </div>
      )}

      {/* ===== ticket stubs ===== */}
      <div className="tickets">
        {visits.map((t) => {
          const s = stamps[t.id]; if (!s) return null;
          const st: CSSProperties = {
            position: "absolute", left: s.x + "px", top: s.y + "px",
            transform: `rotate(${s.rot}deg)`, zIndex: s.z,
            width: "210px", cursor: "pointer", touchAction: "none",
            userSelect: "none", WebkitUserSelect: "none",
            filter: "drop-shadow(0 2px 3px rgba(50,36,20,.2)) drop-shadow(0 10px 20px rgba(50,36,20,.16))",
          };
          return (
            <div key={t.id} style={st} onPointerDown={onDown(t.id)}>
              <div className="ticket-paper">
                <div className="ticket-body">
                  <div className="ticket-head">
                    <span>ADMIT ONE</span>
                    <span style={{ color: t.accent, fontWeight: 600 }}>{t.serial}</span>
                  </div>
                  <div style={{ height: 2, background: t.accent, marginTop: 9 }} />
                  <div style={{ height: 1, background: "rgba(36,31,26,.16)", marginTop: 2 }} />
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight: 58, padding: "15px 2px 9px" }}>
                    <div className="ticket-title">{t.title}</div>
                  </div>
                  <div className="ticket-theatre">{t.theatre}</div>
                  <div className="ticket-city">{t.city}</div>
                  <div style={{ borderTop: "1px dashed rgba(36,31,26,.32)", margin: "14px -16px 0" }} />
                  <div className="ticket-meta">
                    <div><div className="meta-label">SEEN</div><div className="meta-value">{t.date}</div></div>
                    <div style={{ textAlign:"right" }}><div className="meta-label">SEAT</div><div className="meta-value">{t.seat || "—"}</div></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="search-btn" aria-label="Search" onClick={() => setSearchOpen(true)}>
        <span className="ring" /><span className="handle" />
      </button>

      {searchOpen && (
        <div className="search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-eyebrow">Search the Repertoire · {shows.length} trending London shows</div>
          <input
            className="search-input" value={query} autoFocus
            onChange={e => setQuery(e.target.value)}
            onClick={e => e.stopPropagation()}
            placeholder="Title, theatre, genre…"
          />
          <div className="search-results" onClick={e => e.stopPropagation()}>
            {results.length === 0
              ? <div className="search-empty">No matches in the repertoire.</div>
              : results.map(r => (
                  <button className="search-result" key={r.id} onClick={() => setSelected(r)}>
                    <span className="sr-title">{r.title}</span>
                    <span className="sr-sub">{r.genre} · {r.theatre}</span>
                    <span className="sr-go" style={{ color: r.accent }}>View ›</span>
                  </button>
                ))
            }
          </div>
          <div className="search-hint">Click a show for its overview · Esc to close</div>
        </div>
      )}

      {selected && (
        <ShowDetail
          show={selected} dbConfigured={dbConfigured}
          alreadyLogged={visits.filter(v => v.showId === selected.id)}
          onClose={() => setSelected(null)} onLog={logVisit}
        />
      )}

      {expandedVisit && (
        <ExpandedTicket
          visit={expandedVisit}
          onSave={editVisit}
          onDelete={removeVisit}
          onClose={() => setExpandedVisit(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded ticket — same shape as the stub, opened up big.
// ---------------------------------------------------------------------------
function ExpandedTicket({
  visit, onSave, onDelete, onClose,
}: {
  visit: LoggedVisit;
  onSave: (id: string, theatre: string, date: string, seat: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [dateValue, setDateValue] = useState(() => parseDisplayDate(visit.date));
  const [theatre,   setTheatre]   = useState(visit.theatre);
  const [seat,      setSeat]      = useState(visit.seat);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(visit.id, theatre, formatSeenDate(dateValue), seat); onClose(); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(visit.id); }
    finally { setDeleting(false); }
  };

  return (
    <div className="ticket-expand-overlay" onClick={onClose}>
      <div className="ticket-expand-wrap" onClick={e => e.stopPropagation()}>
        <div className="ticket-expand-paper" style={{ "--accent": visit.accent } as CSSProperties}>
          <button className="ticket-expand-close" aria-label="Close" onClick={onClose}>×</button>

          <div className="ticket-expand-body">
            {/* header row */}
            <div className="ticket-head">
              <span>ADMIT ONE</span>
              <span style={{ color: visit.accent, fontWeight: 600 }}>{visit.serial}</span>
            </div>
            <div style={{ height: 3, background: visit.accent, marginTop: 11 }} />
            <div style={{ height: 1, background: "rgba(36,31,26,.16)", marginTop: 2 }} />

            {/* title */}
            <div className="ticket-expand-title">{visit.title}</div>
            <div className="ticket-expand-theatre">{visit.theatre}</div>
            <div className="ticket-expand-city">{visit.city}</div>

            <div className="ticket-expand-divider" />

            {/* edit form */}
            <form onSubmit={handleSave}>
              <div className="ticket-expand-row">
                <label className="ticket-expand-label">
                  <span>Date seen</span>
                  <input type="date" value={dateValue} onChange={e => setDateValue(e.target.value)} required />
                </label>
                <label className="ticket-expand-label">
                  <span>Seat</span>
                  <input type="text" value={seat} onChange={e => setSeat(e.target.value)} placeholder="—" />
                </label>
              </div>
              <label className="ticket-expand-label ticket-expand-full">
                <span>Theatre</span>
                <input type="text" value={theatre} onChange={e => setTheatre(e.target.value)} />
              </label>
              <div className="ticket-expand-actions">
                <button type="submit" className="ticket-expand-save" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className="ticket-expand-delete" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "…" : "Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel: show overview + map + log form.
// ---------------------------------------------------------------------------
function ShowDetail({
  show, dbConfigured, alreadyLogged, onClose, onLog,
}: {
  show: Show; dbConfigured: boolean | null;
  alreadyLogged: LoggedVisit[];
  onClose: () => void;
  onLog: (show: Show, theatre: string, date: string, seat: string) => Promise<void>;
}) {
  const [theatre, setTheatre] = useState(show.theatre);
  const [date,    setDate]    = useState("");
  const [seat,    setSeat]    = useState("");
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const mapSrc = useMemo(
    () => MAPS_KEY ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${mapsQuery(show)}&zoom=16` : null,
    [show]
  );
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery(show)}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date) { setError("Pick the date you saw it."); return; }
    setSaving(true); setError(null);
    try { await onLog(show, theatre.trim() || show.theatre, date, seat.trim()); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save"); }
    finally { setSaving(false); }
  };

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-card" onClick={e => e.stopPropagation()} style={{ "--accent": show.accent } as CSSProperties}>
        <button className="detail-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="detail-genre">{show.genre}</div>
        <h2 className="detail-title">{show.title}</h2>
        <p className="detail-overview">{show.overview}</p>
        <div className="detail-venue">
          <div className="detail-venue-name">{show.theatre}</div>
          <div className="detail-venue-addr">{show.address}</div>
        </div>
        <div className="detail-map">
          {mapSrc
            ? <iframe title={`Map of ${show.theatre}`} src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
            : <a className="detail-map-fallback" href={mapLink} target="_blank" rel="noreferrer">
                <span className="pin">◎</span>View {show.theatre} on Google Maps
                <small>(add a NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to embed the live map here)</small>
              </a>
          }
        </div>
        {done ? (
          <div className="detail-logged">
            <div className="detail-logged-tick" style={{ color: show.accent }}>✓</div>
            <div>Logged — <strong>{show.title}</strong> at {theatre || show.theatre}. Click the stub on stage to edit it.</div>
            <button className="cta" onClick={onClose}>Back to the stage</button>
          </div>
        ) : (
          <form className="log-form" onSubmit={submit}>
            <div className="log-form-eyebrow">Log a visit — record when you saw it</div>
            <div className="log-row">
              <label><span>Date seen</span><input type="date" value={date} max="2099-12-31" onChange={e => setDate(e.target.value)} required /></label>
              <label><span>Seat (optional)</span><input type="text" value={seat} placeholder="e.g. STALLS H14" onChange={e => setSeat(e.target.value)} /></label>
            </div>
            <label className="log-theatre"><span>Theatre seen at</span><input type="text" value={theatre} onChange={e => setTheatre(e.target.value)} placeholder={show.theatre} /></label>
            {error && <div className="log-error">{error}</div>}
            <button className="cta" type="submit" disabled={saving}>{saving ? "Saving…" : "Log this show"}</button>
            <div className="log-store-note">
              {dbConfigured === true ? "Saved to your database." : dbConfigured === false ? "Saved in this browser (add a database to sync across devices)." : ""}
            </div>
          </form>
        )}
        {alreadyLogged.length > 0 && (
          <div className="detail-history">Previously logged: {alreadyLogged.map(v => `${v.date} (${v.theatre})`).join(", ")}</div>
        )}
      </div>
    </div>
  );
}
