import type { SearchHit, SearchResult } from "./searchGraph";

type Props = {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
  result: SearchResult;
  query: string;
  onQueryChange: (q: string) => void;
};

export function SearchPalette({
  open,
  onClose,
  onNavigate,
  result,
  query,
  onQueryChange,
}: Props) {
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setActive(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    setActive(0);
  }, [query]);

  const flatLen = result.flat.length;

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector('[data-idx="' + active + '"]') as HTMLElement | null;
    if (!el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight + 8;
    }
  }, [active, query]);

  if (!open) return null;

  const pick = (hit: SearchHit) => {
    onNavigate(hit.node.href);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (flatLen ? (a + 1) % flatLen : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (flatLen ? (a - 1 + flatLen) % flatLen : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = result.flat[active];
      if (it) pick(it);
    }
  };

  let idx = -1;
  const q = query.trim();

  return React.createElement(
    "div",
    {
      className: "search-overlay",
      onMouseDown: (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
      },
      onKeyDown,
    },
    React.createElement(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Search the site",
        className: "search-dialog",
      },
      React.createElement(
        "div",
        { className: "search-input-row" },
        React.createElement("input", {
          ref: inputRef,
          value: query,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            onQueryChange(e.target.value),
          placeholder: "Search work, blog, and skills",
          autoComplete: "off",
          autoCorrect: "off",
          spellCheck: false,
          "aria-label": "Search query",
        }),
        React.createElement(
          "button",
          { type: "button", className: "search-esc", onClick: onClose, "aria-label": "Close search" },
          "esc",
        ),
      ),
      React.createElement(
        "div",
        { ref: listRef, className: "search-results", role: "listbox" },
        !q
          ? React.createElement(
              "div",
              { className: "search-empty" },
              "Search across work, blog, and skills. Try ",
              React.createElement("span", null, "CI/CD"),
              ", ",
              React.createElement("span", null, "emit"),
              ", or ",
              React.createElement("span", null, "Fit"),
              ".",
            )
          : result.flat.length === 0
            ? React.createElement(
                "div",
                { className: "search-empty" },
                'No matches for “' + q + '”.',
              )
            : result.groups.map((grp) =>
                React.createElement(
                  "div",
                  { key: grp.key, className: "search-group" },
                  React.createElement("div", { className: "search-group-label" }, grp.label),
                  grp.items.map((it) => {
                    idx += 1;
                    const my = idx;
                    return React.createElement(
                      "button",
                      {
                        key: it.node.id + (it.kind === "connected" ? ":c" : ""),
                        type: "button",
                        role: "option",
                        "aria-selected": my === active,
                        "data-idx": my,
                        className: "search-row" + (my === active ? " active" : ""),
                        onMouseMove: () => setActive(my),
                        onClick: () => pick(it),
                      },
                      React.createElement(
                        "span",
                        { className: "search-row-title" },
                        it.node.title,
                      ),
                      React.createElement(
                        "span",
                        { className: "search-row-meta" },
                        it.kind === "connected" && it.via
                          ? "via " + it.via
                          : it.node.kindLabel,
                      ),
                    );
                  }),
                ),
              ),
      ),
      React.createElement(
        "div",
        { className: "search-footer" },
        React.createElement("span", null, "↑↓ navigate · ↵ open · esc close"),
        React.createElement(
          "span",
          null,
          q ? result.count + " match" + (result.count === 1 ? "" : "es") : "Ctrl/⌘ K",
        ),
      ),
    ),
  );
}
