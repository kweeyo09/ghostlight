# Limelight — Theatre Log

A theatrical, animated web page for logging West End shows you've seen. Ticket-stub
"stamps" sit under a round spotlight against a softly swaying red stage curtain.

## Features

- **Swaying curtain** — 16 procedurally laid-out folds that breathe idly and lean
  toward the cursor (`requestAnimationFrame` loop, distance-weighted influence).
- **Round spotlight** — a pulsing warm glow plus a matching vignette that darkens
  the edges of the stage.
- **Draggable ticket stamps** — five shows (The Lion King, The Phantom of the Opera,
  Wicked, Les Misérables, Mamma Mia!) rendered as perforated paper stubs with
  hand-built CSS artwork. Drag any stamp; it raises to the top of the stack.
- **Full-page search** — tap the magnifier to open an immersive search overlay;
  close with Esc or by clicking anywhere outside the field.

## Running

It's a single static file — no build step, no dependencies.

```sh
# just open it
start index.html        # Windows
# or serve it
python -m http.server   # then visit http://localhost:8000
```

Fonts (Playfair Display, EB Garamond) load from Google Fonts, so an internet
connection gives the intended look.

## Source

The visual design originates from a Claude Design project ("theatre web"). The
original component, authored in Claude Design's `.dc.html` runtime format
(`x-dc` / `DCLogic` with `{{ }}` bindings), is preserved at
[`Theatre Log.dc.html`](Theatre%20Log.dc.html) for reference. [`index.html`](index.html)
is a standalone, framework-free implementation of that design in plain
HTML/CSS/vanilla JS.
