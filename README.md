# recruit-me

Open-source (Apache-2.0) personal portfolio **site template** + recruiter **Fit**
surface: paste a job description → cite-or-missing evidence brief against your
published `/work` and `/blog`.

Demo persona: fictional **Avery Quill** (not a real person).

## Quick start

```powershell
pip install --user pyyaml
npm ci
npm run test
npm run preview
```

Open http://localhost:4173/fit and paste a sample JD.

## Layout

| Path | Role |
|------|------|
| `content/about\|work\|blog/` | Adopter-owned YAML |
| `content/config/skills.yaml` | Skill-bank category map (tenant) |
| `scripts/emit-content.py` | Splices typed blocks into `src/app.tsx` |
| `src/fit/` | Deterministic Fit matcher + UI |
| `src/skills/` | Skill-bank UI + `?skill=` filter |
| `graph/` + `src/graph/` | CSP-safe WebGL engine + KG builder (`/graph`) |
| `functions/api/fit.ts` | Optional same-origin `POST /api/fit` |
| `docs/` | PRDs, ADRs, security, handoff |

## License

Apache-2.0 — see [LICENSE](./LICENSE).

## Handoff

See [HANDOFF.md](./HANDOFF.md) for product decisions and next slices.
