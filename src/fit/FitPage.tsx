import type { FitBrief } from "../types";
import type { EvidenceDoc } from "./types";
import { matchFit } from "./match";

const MAX_CHARS = 12000;
const MAX_BYTES = 1024 * 1024;

type Props = {
  docs: EvidenceDoc[];
  onNavigate: (path: string) => void;
};

export function FitPage({ docs, onNavigate }: Props) {
  const [jd, setJd] = React.useState("");
  const [brief, setBrief] = React.useState<FitBrief | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  function run(text: string) {
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
      setBrief(matchFit(trimmed, docs));
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
    run(text.slice(0, MAX_CHARS));
  }

  return React.createElement(
    "section",
    { className: "page fit-page" },
    React.createElement("h1", null, "Fit"),
    React.createElement(
      "p",
      { className: "lede" },
      "Paste or drop a job description. Get a cite-or-missing evidence brief against published work and blog — never invented employers or years.",
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
    React.createElement("p", null, brief.role_read),
    React.createElement("h2", null, "Requirements"),
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
