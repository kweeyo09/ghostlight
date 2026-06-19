# Limelight — Theatre Log

A theatrical, animated web page for logging West End shows you've seen. Ticket-stub
"stamps" sit under a round spotlight against a softly swaying red stage curtain.

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
