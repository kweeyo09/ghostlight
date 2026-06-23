import { NextRequest, NextResponse } from "next/server";
import { getShow, type LoggedVisit } from "@/lib/shows";
import { addVisit, deleteVisit, isDbConfigured, listVisits, updateVisit } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/logs  →  every logged visit (newest stored last).
// If no database is configured, `configured: false` tells the client to fall
// back to localStorage.
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false, visits: [] });
  }
  try {
    const visits = await listVisits();
    return NextResponse.json({ configured: true, visits });
  } catch (err) {
    return NextResponse.json(
      { configured: true, error: String(err), visits: [] },
      { status: 500 }
    );
  }
}

// POST /api/logs  →  log a visit. Body: { showId, theatre?, date, seat? }
export async function POST(req: NextRequest) {
  let body: { showId?: string; theatre?: string; date?: string; seat?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const show = body.showId ? getShow(body.showId) : undefined;
  if (!show) {
    return NextResponse.json({ error: "Unknown showId" }, { status: 400 });
  }

  const date = (body.date ?? "").trim();
  if (!date) {
    return NextResponse.json({ error: "A date is required" }, { status: 400 });
  }

  const visit: LoggedVisit = {
    id: `${show.id}-${Date.now()}`,
    showId: show.id,
    title: show.title,
    theatre: (body.theatre ?? "").trim() || show.theatre,
    city: show.city,
    date,
    seat: (body.seat ?? "").trim(),
    serial: `№ ${String(Math.floor(Date.now() / 1000) % 10000).padStart(4, "0")}`,
    accent: show.accent,
    createdAt: new Date().toISOString(),
  };

  if (!isDbConfigured()) {
    // No DB — hand the fully-formed visit back so the client can localStorage it.
    return NextResponse.json({ configured: false, visit });
  }

  try {
    await addVisit(visit);
    return NextResponse.json({ configured: true, visit });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/logs  →  edit theatre/date/seat of an existing visit.
export async function PATCH(req: NextRequest) {
  let body: { id?: string; theatre?: string; date?: string; seat?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { id, theatre, date, seat } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });
  if (!isDbConfigured()) return NextResponse.json({ configured: false, id });
  try {
    await updateVisit(id, {
      theatre: (theatre ?? "").trim(),
      date: (date ?? "").trim(),
      seat: (seat ?? "").trim(),
    });
    return NextResponse.json({ configured: true, id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/logs?id=…  →  remove a logged visit.
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (!isDbConfigured()) {
    return NextResponse.json({ configured: false, id });
  }
  try {
    await deleteVisit(id);
    return NextResponse.json({ configured: true, id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
