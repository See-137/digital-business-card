# Oleg Hanukayev — Personal Site

Portfolio and digital business card in one page. Live at https://oleg-hanukayev.pages.dev/

Static site, no build step. Serve the folder locally (the service worker and fonts need http, not `file://`):

```bash
python -m http.server 3137
```

Regression checks live in `tests/` (`npm ci`, then `npm test`). See `CLAUDE.md` for the file map and conventions.
