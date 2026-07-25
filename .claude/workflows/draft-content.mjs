export const meta = {
  name: 'draft-content',
  description: 'Draft content/work YAML from the adopter\'s own sources, grounded and reviewable',
  whenToUse: 'Invoked by /build-recruit-me when content/config/sources.yaml names a source and the user opted into drafting.',
  phases: [
    { title: 'Discover', detail: 'one agent per configured source; return candidate projects' },
    { title: 'Draft', detail: 'one agent per candidate; write a visible:false YAML draft' },
    { title: 'Ground', detail: 'adversarial check that every claim traces to the source' },
    { title: 'Report', detail: 'synthesize what needs human attention' },
  ],
}

/*
 * args: { sources: {github?: {user, include_forks, max_repos}, resume?: string},
 *         maxCandidates?: number }
 *
 * The integrity rule, enforced at two stages and stated in every prompt: a
 * draft may only assert what its source actually says. This project's product
 * is a Fit brief that cites published evidence — content invented here would
 * become a fabricated citation later. Unknowns become TODO markers.
 */

const sources = (args && args.sources) || {}
const MAX = (args && args.maxCandidates) || 8

const CANDIDATES = {
  type: 'object',
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['slug', 'title', 'evidenceUrl', 'facts'],
        properties: {
          slug: { type: 'string', description: 'kebab-case, becomes the filename' },
          title: { type: 'string' },
          evidenceUrl: { type: 'string', description: 'where these facts came from' },
          facts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Verbatim-grounded statements from the source. No inference.',
          },
        },
      },
    },
  },
}

const DRAFT = {
  type: 'object',
  required: ['slug', 'path', 'todoCount'],
  properties: {
    slug: { type: 'string' },
    path: { type: 'string' },
    todoCount: { type: 'integer', description: 'how many TODO markers were left' },
    notes: { type: 'string' },
  },
}

const VERDICT = {
  type: 'object',
  required: ['slug', 'ungrounded'],
  properties: {
    slug: { type: 'string' },
    ungrounded: {
      type: 'array',
      items: { type: 'string' },
      description: 'Claims in the draft that the source does not support. Empty if clean.',
    },
  },
}

const GROUND_RULE = `
INTEGRITY RULE - this overrides any instinct to write good-sounding copy:
Only state what the source actually supports. Do not infer impact, scale,
metrics, dates, employers, or team size. Anything you cannot ground becomes a
literal "TODO: <what the human needs to supply>" string in the YAML. A draft
full of TODOs is a success; an impressive draft with an invented metric is a
failure, because a Fit brief will later cite it to a recruiter as evidence.
`

phase('Discover')

const discoverers = []
if (sources.github && sources.github.user) {
  discoverers.push(() =>
    agent(
      `Read the PUBLIC repositories of GitHub user "${sources.github.user}" (use the gh CLI or the public API; read-only).
${sources.github.include_forks ? '' : 'Skip forks. '}Consider at most ${sources.github.max_repos || 12} repos, most substantial first.
For each, return a candidate with: a kebab-case slug, a title, the repo URL as evidenceUrl, and a "facts" list drawn ONLY from the repo's README, description, topics and language stats.
${GROUND_RULE}`,
      { label: 'discover:github', phase: 'Discover', schema: CANDIDATES },
    ),
  )
}
if (sources.resume) {
  discoverers.push(() =>
    agent(
      `Read the plain-text resume at "${sources.resume}". Identify distinct PROJECTS or systems the author built (not job titles).
For each, return a candidate whose "facts" quote or closely paraphrase the resume lines that describe it. evidenceUrl should be the resume path.
${GROUND_RULE}`,
      { label: 'discover:resume', phase: 'Discover', schema: CANDIDATES },
    ),
  )
}

if (!discoverers.length) {
  log('No sources configured in content/config/sources.yaml - nothing to draft.')
  return { drafted: [], skipped: 'no-sources' }
}

// Barrier is correct here: candidates must be deduped across sources (a repo
// and a resume line often describe the same project) before we spend an agent
// writing each one.
const discovered = (await parallel(discoverers)).filter(Boolean)
const seen = new Set()
const candidates = []
for (const result of discovered) {
  for (const c of result.candidates || []) {
    const key = c.slug.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(c)
  }
}

if (!candidates.length) {
  log('Sources yielded no candidates.')
  return { drafted: [], skipped: 'no-candidates' }
}

const selected = candidates.slice(0, MAX)
if (candidates.length > selected.length) {
  log(`${candidates.length} candidates found; drafting the first ${selected.length} (maxCandidates).`)
}
log(`Drafting ${selected.length} project(s): ${selected.map((c) => c.slug).join(', ')}`)

// Pipeline, not a barrier: each candidate can be grounded the moment its own
// draft lands, instead of waiting for the slowest draft.
const results = await pipeline(
  selected,
  (c) =>
    agent(
      `Write content/work/${c.slug}.yaml for this project.

Title: ${c.title}
Source: ${c.evidenceUrl}
Grounded facts:
${(c.facts || []).map((f) => `- ${f}`).join('\n')}

Follow the schema of the existing files in content/work/ exactly: slug (must equal the filename stem), title, summary, body, skills, problem, outcome, evidence (list), decisions (list), skill_notes (map), visible, date.

REQUIRED: set "visible: false". These are drafts; a human flips that after reading.
Use {{work:slug|Label}} / {{blog:slug|Label}} tokens for cross-links only to pages that actually exist.
${GROUND_RULE}

Return the slug, the path you wrote, and how many TODO markers you left.`,
      { label: `draft:${c.slug}`, phase: 'Draft', schema: DRAFT },
    ),
  (draft, c) =>
    agent(
      `Adversarially check the draft at ${draft && draft.path ? draft.path : `content/work/${c.slug}.yaml`}.

Its ONLY permitted source is:
${(c.facts || []).map((f) => `- ${f}`).join('\n')}

Read the file and list every claim it makes that those facts do not support - invented metrics, implied scale, asserted dates, named employers, inferred outcomes. Judge the text as written, not as intended. An empty list means clean; do not pad it, and do not excuse a claim because it sounds plausible.`,
      { label: `ground:${c.slug}`, phase: 'Ground', schema: VERDICT },
    ).then((v) => ({ candidate: c, draft, verdict: v })),
)

const clean = []
const flagged = []
for (const r of results.filter(Boolean)) {
  const bad = (r.verdict && r.verdict.ungrounded) || []
  if (bad.length) flagged.push(r)
  else clean.push(r)
}

phase('Report')
log(`${clean.length} clean draft(s), ${flagged.length} with ungrounded claims.`)

return {
  drafted: results.filter(Boolean).map((r) => ({
    slug: r.candidate.slug,
    path: r.draft && r.draft.path,
    todoCount: (r.draft && r.draft.todoCount) || 0,
    ungrounded: (r.verdict && r.verdict.ungrounded) || [],
  })),
  cleanCount: clean.length,
  flaggedCount: flagged.length,
}
