import type { FitBrief } from "../types";
import type { FitMatchConfig } from "./config";
import type { EvidenceDoc } from "./types";
import { matchFit } from "./match";

const MAX_CHARS = 12000;
const MAX_BYTES = 1024 * 1024;

type Props = {
  docs: EvidenceDoc[];
  onNavigate: (path: string) => void;
};

/**
 * Tenant tuning (stops, synonyms, weights, caveats) is authored in
 * content/config/fit.yaml and emitted to /fit-config.json at build time.
 *
 * One shared promise, resolved once per page load. A ref would have let the
 * first submission race the fetch: clicking Run or dropping a file before it
 * landed produced a brief built on engine defaults, silently missing the
 * tenant's stop words and extraCaveats. Awaiting the promise costs nothing
 * after the first call and is correct on the first.
 *
 * A missing or malformed file resolves to undefined rather than rejecting —
 * the engine defaults are a complete, working configuration on their own.
 */
let fitConfigPromise: Promise<FitMatchConfig | undefined> | null = null;

function loadFitConfig(): Promise<FitMatchConfig | undefined> {
  if (!fitConfigPromise) {
    fitConfigPromise = fetch("/fit-config.json")
      .then((r) => {
        if (!r.ok) throw new Error(`fit-config ${r.status}`);
        return r.json() as Promise<FitMatchConfig>;
      })
      .catch(() => {
        // Only SUCCESS is memoized. Caching a failure would strand the page on
        // engine defaults for the rest of the session, so a transient error on
        // first load could never recover; dropping it lets the next run retry.
        fitConfigPromise = null;
        return undefined;
      });
  }
  return fitConfigPromise;
}

export function FitPage({ docs, onNavigate }: Props) {
  const [jd, setJd] = React.useState("");
  const [brief, setBrief] = React.useState<FitBrief | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Warm it on mount so the first submission usually doesn't wait.
  React.useEffect(() => {
    void loadFitConfig();
  }, []);

  async function run(text: string) {
    setError("");
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Paste a job description first.");
      setBrief(null);
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setError(`JD exceeds ${MAX_CHARS} character cap.`);
      return;
    }
    setBusy(true);
    try {
      setBrief(matchFit(trimmed, docs, await loadFitConfig()));
    } finally {
      setBusy(false);
    }
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("File exceeds 1 MB cap.");
      return;
    }
    if (!/\.(txt|md)$/i.test(file.name) && file.type && !file.type.startsWith("text/")) {
      setError("Only .txt / .md text files are accepted.");
      return;
    }
    const text = await file.text();
    setJd(text.slice(0, MAX_CHARS));
    await run(text.slice(0, MAX_CHARS));
  }

  return React.createElement(
    "section",
    { className: "page fit-page" },
    React.createElement("p", { className: "eyebrow" }, "Recruiter tool"),
    React.createElement("h1", null, "Fit"),
    React.createElement(
      "p",
      { className: "lede" },
      // True in both modes on purpose. "Every requirement shown is matched"
      // would be false under showGaps: true, where uncited rows appear — and
      // this lede renders before the config has loaded, so it cannot depend on
      // the mode without flashing the wrong copy.
      "Paste or drop a job description. Every claim the brief makes is quoted from a page published on this site — never an invented employer, date, or number.",
    ),
    React.createElement(
      "div",
      {
        className: "fit-drop",
        onDragOver: (e: React.DragEvent) => e.preventDefault(),
        onDrop,
      },
      React.createElement("textarea", {
        value: jd,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setJd(e.target.value.slice(0, MAX_CHARS)),
        placeholder: "Paste JD here (max 12k chars)…",
        rows: 12,
        "aria-label": "Job description",
      }),
      React.createElement(
        "div",
        { className: "fit-actions" },
        React.createElement(
          "button",
          { type: "button", className: "btn", disabled: busy, onClick: () => run(jd) },
          busy ? "Matching…" : "Run Fit",
        ),
        React.createElement("span", { className: "muted" }, `${jd.length} / ${MAX_CHARS}`),
      ),
    ),
    error ? React.createElement("p", { className: "error", role: "alert" }, error) : null,
    brief ? React.createElement(FitBriefView, { brief, onNavigate }) : null,
  );
}

function FitBriefView({
  brief,
  onNavigate,
}: {
  brief: FitBrief;
  onNavigate: (path: string) => void;
}) {
  return React.createElement(
    "div",
    { className: "fit-brief" },
    React.createElement("h2", null, "Role read-back"),
    React.createElement("p", { className: "prose" }, brief.role_read),
    React.createElement(
      "h2",
      null,
      brief.gaps.length ? "Requirements" : "Requirements covered by published work",
    ),
    // In highlight mode a JD with no overlap returns nothing at all. An empty
    // <ul> reads as a broken tool, so say plainly that there is nothing to
    // show — factual, and without volunteering a verdict on the candidate.
    brief.requirements.length === 0
      ? React.createElement(
          "p",
          { className: "card-empty" },
          "Nothing in the published work maps to this description. Try a job description closer to the work on this site.",
        )
      : null,
    React.createElement(
      "ul",
      { className: "fit-reqs" },
      brief.requirements.map((r, i) =>
        React.createElement(
          "li",
          { key: i, className: `fit-req status-${r.status}` },
          React.createElement("div", { className: "fit-req-head" },
            React.createElement("span", { className: "badge" }, r.status),
            React.createElement("span", { className: "badge soft" }, r.priority),
          ),
          React.createElement("p", { className: "fit-req-text" }, r.text),
          React.createElement("p", { className: "muted" }, r.why),
          r.evidence.length
            ? React.createElement(
                "ul",
                { className: "fit-cites" },
                r.evidence.map((e, j) =>
                  React.createElement(
                    "li",
                    { key: j },
                    React.createElement(
                      "a",
                      {
                        href: e.url,
                        onClick: (ev: React.MouseEvent) => {
                          ev.preventDefault();
                          onNavigate(e.url);
                        },
                      },
                      e.title,
                    ),
                    " — ",
                    e.quote_or_skill,
                  ),
                ),
              )
            : null,
        ),
      ),
    ),
    brief.gaps.length
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement("h2", null, "Gaps"),
          React.createElement(
            "ul",
            null,
            brief.gaps.map((g, i) => React.createElement("li", { key: i }, g)),
          ),
        )
      : null,
    React.createElement("h2", null, "Caveats"),
    React.createElement(
      "ul",
      null,
      brief.caveats.map((c, i) => React.createElement("li", { key: i }, c)),
    ),
  );
}
