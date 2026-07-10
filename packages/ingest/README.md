# Ingest helpers

Draft generators that emit YAML **for human review** before copying into
`content/`. They never write production content automatically.

| Script | Input | Output |
|--------|-------|--------|
| `from-resume-text.py` | Plain-text resume | Draft `work` / `about` YAML snippets |
| `from-github.py` | Public GitHub username | Draft project stubs via GitHub API |

## LinkedIn

Official **data-export ZIP → parser** only. No scrapers, Voyager, or cookie bots.
Parser not built yet — track in HANDOFF §8.
