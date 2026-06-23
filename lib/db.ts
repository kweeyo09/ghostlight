// ---------------------------------------------------------------------------
// Persistence for logged theatre visits.
//
// Primary store: a real database (Vercel Postgres / Neon) via @vercel/postgres,
// activated whenever a Postgres connection string is present in the environment
// (POSTGRES_URL — Vercel sets this automatically when you attach a Postgres /
// Neon store to the project).
//
// Fallback: when no database is configured (e.g. a fresh local clone before you
// provision one), the API routes report `configured: false` and the client
// transparently persists visits in the browser's localStorage instead, so the
// app is fully usable out of the box and becomes durable + cross-device the
// moment you add the env var.
// ---------------------------------------------------------------------------

import type { LoggedVisit } from "./shows";

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.DATABASE_URL
  );
}

// Lazily import @vercel/postgres so a clone without the dependency installed,
// or without a connection string, never crashes at module load.
async function sql() {
  const mod = await import("@vercel/postgres");
  return mod.sql;
}

let initialised = false;
async function ensureTable() {
  if (initialised) return;
  const q = await sql();
  await q`
    CREATE TABLE IF NOT EXISTS visits (
      id          TEXT PRIMARY KEY,
      show_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      theatre     TEXT NOT NULL,
      city        TEXT NOT NULL DEFAULT 'London',
      date        TEXT NOT NULL,
      seat        TEXT NOT NULL DEFAULT '',
      serial      TEXT NOT NULL,
      accent      TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  initialised = true;
}

function rowToVisit(r: Record<string, unknown>): LoggedVisit {
  return {
    id: String(r.id),
    showId: String(r.show_id),
    title: String(r.title),
    theatre: String(r.theatre),
    city: String(r.city),
    date: String(r.date),
    seat: String(r.seat ?? ""),
    serial: String(r.serial),
    accent: String(r.accent),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listVisits(): Promise<LoggedVisit[]> {
  await ensureTable();
  const q = await sql();
  const { rows } = await q`SELECT * FROM visits ORDER BY created_at ASC`;
  return rows.map(rowToVisit);
}

export async function addVisit(v: LoggedVisit): Promise<LoggedVisit> {
  await ensureTable();
  const q = await sql();
  await q`
    INSERT INTO visits (id, show_id, title, theatre, city, date, seat, serial, accent)
    VALUES (${v.id}, ${v.showId}, ${v.title}, ${v.theatre}, ${v.city}, ${v.date}, ${v.seat}, ${v.serial}, ${v.accent})
    ON CONFLICT (id) DO UPDATE
      SET theatre = EXCLUDED.theatre,
          date    = EXCLUDED.date,
          seat    = EXCLUDED.seat
  `;
  return v;
}

export async function updateVisit(
  id: string,
  updates: { theatre: string; date: string; seat: string }
): Promise<void> {
  await ensureTable();
  const q = await sql();
  await q`
    UPDATE visits
    SET theatre = ${updates.theatre},
        date    = ${updates.date},
        seat    = ${updates.seat}
    WHERE id = ${id}
  `;
}

export async function deleteVisit(id: string): Promise<void> {
  await ensureTable();
  const q = await sql();
  await q`DELETE FROM visits WHERE id = ${id}`;
}
