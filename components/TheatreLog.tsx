"use client";

import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Show } from "@/lib/shows";

interface Stamp {
  x: number;
  y: number;
  rot: number;
  z: number;
}

// ---- paper-cut curtain geometry (uneven, hand-cut) -------------------------
function pleatStyle(w: number, h: number, rot: number, rad: number, dir: number): CSSProperties {
  return {
    flexGrow: w,
    flexBasis: 0,
    height: h + "%",
    alignSelf: "flex-start",
    background: `linear-gradient(${dir}deg, oklch(0.73 0.066 44) 0%, oklch(0.64 0.088 38) 34%, oklch(0.5 0.096 33) 64%, oklch(0.6 0.09 36) 90%)`,
    borderBottomLeftRadius: rad + "px",
    borderBottomRightRadius: rad - 18 + "px",
    transform: `rotate(${rot}deg)`,
    transformOrigin: "50% 0%",
    boxShadow: "-5px 0 11px rgba(64,26,10,.16)",
    willChange: "transform",
  };
}

// [flexGrow, height%, rot, radius, gradientDir]
const LEFT: [number, number, number, number, number][] = [
  [1.15, 98, -1.2, 66, 102], [0.9, 90, 0.8, 82, 78], [1.25, 100, -0.6, 56, 104],
  [0.85, 93, 1.4, 90, 80], [1.1, 96, -1.0, 64, 100], [0.95, 87, 0.5, 76, 82],
];
const RIGHT: [number, number, number, number, number][] = [
  [0.95, 89, 1.0, 80, 80], [1.2, 96, -0.7, 58, 102], [0.88, 92, 1.3, 88, 78],
  [1.15, 100, -1.1, 62, 104], [0.92, 90, 0.6, 84, 80], [1.22, 97, -1.4, 56, 100],
];

// uneven scalloped valance swags
const SWAG_W = [1.1, 0.85, 1.25, 0.95, 1.15, 0.8, 1.2, 0.9, 1.1, 0.86, 1.18];
const SWAG_H = [54, 40, 60, 46, 56, 38, 58, 44, 52, 42, 56];

export default function TheatreLog({ shows }: { shows: Show[] }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Show[]>(shows);

  const [stamps, setStamps] = useState<Record<string, Stamp>>(() => {
    const init: Record<string, Stamp> = {};
    shows.forEach((s) => (init[s.id] = { ...s.pos }));
    return init;
  });

  // ---- curtain animation (cursor-reactive pleats) ----
  const pleatsRef = useRef<HTMLDivElement[]>([]);
  const centersRef = useRef<number[]>([]);
  const rotsRef = useRef<number[]>([]);
  const mx = useRef(0);
  const tx = useRef(0);
  const t0 = useRef(0);

  const setPleat = (i: number) => (el: HTMLDivElement | null) => {
    if (el) pleatsRef.current[i] = el;
  };

  const measure = useCallback(() => {
    centersRef.current = pleatsRef.current.map((el) => {
      const r = el.getBoundingClientRect();
      return r.left + r.width / 2;
    });
  }, []);

  useEffect(() => {
    rotsRef.current = [...LEFT, ...RIGHT].map((p) => p[2]);
    mx.current = tx.current = window.innerWidth / 2;
    t0.current = performance.now();
    measure();

    const onMouse = (e: MouseEvent) => (tx.current = e.clientX);
    const onResize = () => measure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);

    let raf = 0;
    const loop = (now: number) => {
      const t = now - t0.current;
      const W = window.innerWidth;
      mx.current += (tx.current - mx.current) * 0.09; // eased follow
      const m = mx.current;
      const pl = pleatsRef.current;
      for (let i = 0; i < pl.length; i++) {
        const el = pl[i];
        if (!el) continue;
        const cx = centersRef.current[i] ?? W / 2;
        const rot = rotsRef.current[i] ?? 0;
        const phase = i * 0.5;
        const idle = Math.sin(t * 0.0011 + phase) * 3;
        const d = m - cx;
        const infl = Math.exp(-(d * d) / (W * W * 0.13));
        const lean = d * 0.04 * infl;
        const sway = idle + lean;
        const breathe = 1 + 0.009 * Math.sin(t * 0.0011 + phase);
        el.style.transform = `rotate(${rot}deg) translateX(${sway.toFixed(2)}px) skewX(${(sway * 0.035).toFixed(3)}deg) scaleY(${breathe.toFixed(4)})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  // ---- ticket dragging ----
  const drag = useRef<{ id: string; sx: number; sy: number; x0: number; y0: number } | null>(null);

  const onDown = (id: string) => (e: ReactPointerEvent) => {
    e.preventDefault();
    const st = stamps[id];
    drag.current = { id, sx: e.clientX, sy: e.clientY, x0: st.x, y0: st.y };
    setStamps((s) => {
      const mz = Math.max(...Object.values(s).map((v) => v.z));
      return { ...s, [id]: { ...s[id], z: mz + 1 } };
    });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const nx = d.x0 + (e.clientX - d.sx);
    const ny = d.y0 + (e.clientY - d.sy);
    setStamps((s) => ({ ...s, [d.id]: { ...s[d.id], x: nx, y: ny } }));
  };
  const onUp = () => {
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  // ---- search (talks to the /api/search backend) ----
  useEffect(() => {
    if (!searchOpen) return;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { results: Show[] }) => setResults(d.results))
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query, searchOpen]);

  return (
    <div className="stage">
      {/* ===== valance ===== */}
      <div className="valance">
        <div className="valance-bar">
          <div className="valance-title">Limelight</div>
        </div>
        <div className="swag-row">
          {SWAG_W.map((w, i) => (
            <div
              key={i}
              style={{
                flexGrow: w,
                flexBasis: 0,
                height: SWAG_H[i] + "px",
                background:
                  "linear-gradient(180deg, oklch(0.54 0.094 34) 0%, oklch(0.47 0.098 32) 100%)",
                borderBottomLeftRadius: "60% 100%",
                borderBottomRightRadius: "60% 100%",
                boxShadow: "0 4px 8px rgba(60,24,8,.18)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ===== side curtains ===== */}
      <div className="curtain curtain-left">
        {LEFT.map((p, i) => (
          <div key={i} ref={setPleat(i)} style={pleatStyle(p[0], p[1], p[2], p[3], p[4])} />
        ))}
      </div>
      <div className="curtain curtain-right">
        {RIGHT.map((p, i) => (
          <div key={i} ref={setPleat(LEFT.length + i)} style={pleatStyle(p[0], p[1], p[2], p[3], p[4])} />
        ))}
      </div>

      {/* ===== ticket stubs ===== */}
      <div className="tickets">
        {shows.map((t) => {
          const s = stamps[t.id];
          const st: CSSProperties = {
            position: "absolute",
            left: s.x + "px",
            top: s.y + "px",
            transform: `rotate(${s.rot}deg)`,
            zIndex: s.z,
            width: "210px",
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            filter:
              "drop-shadow(0 2px 3px rgba(50,36,20,.2)) drop-shadow(0 10px 20px rgba(50,36,20,.16))",
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 58,
                      padding: "15px 2px 9px",
                    }}
                  >
                    <div className="ticket-title">{t.title}</div>
                  </div>
                  <div className="ticket-theatre">{t.theatre}</div>
                  <div className="ticket-city">{t.city}</div>
                  <div style={{ borderTop: "1px dashed rgba(36,31,26,.32)", margin: "14px -16px 0" }} />
                  <div className="ticket-meta">
                    <div>
                      <div className="meta-label">SEEN</div>
                      <div className="meta-value">{t.date}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="meta-label">SEAT</div>
                      <div className="meta-value">{t.seat}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== search button ===== */}
      <button className="search-btn" aria-label="Search" onClick={() => setSearchOpen(true)}>
        <span className="ring" />
        <span className="handle" />
      </button>

      {/* ===== full-page search ===== */}
      {searchOpen && (
        <div className="search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-eyebrow">Search the Repertoire</div>
          <input
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            placeholder="Title, theatre, or date seen…"
          />
          <div className="search-results" onClick={(e) => e.stopPropagation()}>
            {results.length === 0 ? (
              <div className="search-empty">No matches in the repertoire.</div>
            ) : (
              results.map((r) => (
                <div className="search-result" key={r.id}>
                  <span className="sr-title">{r.title}</span>
                  <span className="sr-sub">
                    {r.theatre} · {r.date}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="search-hint">Press Esc, or click anywhere, to close</div>
        </div>
      )}
    </div>
  );
}
