"""Picks the mermaid modules a document actually needs out of `vendor/mermaid/`.

mermaid publishes `dist/` as one entry module plus one module per diagram type, reached by
dynamic import. The whole set inlined comes to about 4.8 MB, while a document drawing
flowcharts needs 0.6 MB of it. `select` walks the static imports of the entry and of the
diagram types found in the markdown, and returns only those modules.

The modules are ES modules importing each other by relative path, which no longer resolves
once the text sits inside an HTML file. `runtime` emits each module as a blob URL and
rewrites the specifiers to point at those URLs.
"""

import json
import pathlib
import re

# The entry of the minified ESM build. `dist/mermaid.esm.min.mjs` is a two line re-export
# of this module, and `b9` is the mermaid object it exports as default.
ENTRY = "mermaid.esm.min.mjs"
EXPORT = "b9"

# The UMD build of the same release: every diagram type, minified as one program, and it
# puts mermaid on `window` from a classic script. It is smaller than the modules for every
# type put together, because minifying across module boundaries is what a bundle can do and
# a set of published modules cannot.
BUNDLE = "mermaid.min.js"

STATIC_IMPORT = re.compile(r'((?:from|import)\s*)"\./([^"]+\.js)"')
DYNAMIC_IMPORT = re.compile(r'import\("\./([^"]+\.js)"\)')

# The first word of a mermaid block against the module that draws it. A module is named
# after the diagram, and the hash in the filename changes between mermaid releases, so the
# value here is a filename prefix rather than a filename.
#
# `graph` and `flowchart` are given both flowchart modules because which one runs depends
# on the `flowchart.defaultRenderer` setting rather than on the source.
DIAGRAM_MODULES = {
    "graph": ["flowDiagram-v2-", "flowDiagram-"],
    "flowchart": ["flowDiagram-v2-", "flowDiagram-"],
    "flowchart-v2": ["flowDiagram-v2-", "flowDiagram-"],
    "flowchart-elk": ["flowchart-elk-definition-"],
    "sequencediagram": ["sequenceDiagram-"],
    "classdiagram": ["classDiagram-v2-", "classDiagram-"],
    "classdiagram-v2": ["classDiagram-v2-"],
    "statediagram": ["stateDiagram-v2-", "stateDiagram-"],
    "statediagram-v2": ["stateDiagram-v2-"],
    "erdiagram": ["erDiagram-"],
    "journey": ["journeyDiagram-"],
    "gantt": ["ganttDiagram-"],
    "pie": ["pieDiagram-"],
    "quadrantchart": ["quadrantDiagram-"],
    "requirementdiagram": ["requirementDiagram-"],
    "gitgraph": ["gitGraphDiagram-"],
    "c4context": ["c4Diagram-"],
    "mindmap": ["mindmap-definition-"],
    "timeline": ["timeline-definition-"],
    "sankey-beta": ["sankeyDiagram-"],
    "xychart-beta": ["xychartDiagram-"],
    "block-beta": ["blockDiagram-"],
    "info": ["infoDiagram-"],
}

# Math in a label is rendered by katex, which mermaid reaches for through the same dynamic
# import as a diagram type.
KATEX_MODULES = ["katex-"]

FENCE = re.compile(r"^([ \t]*)(?:```+|~~~+)[ \t]*(\w+)[^\n]*\n(.*?)^\1(?:```+|~~~+)", re.S | re.M)

# A mermaid block may open with a frontmatter block before the line that says what it is.
BLOCK_FRONTMATTER = re.compile(r"\A\s*---\r?\n.*?\r?\n---[ \t]*\r?\n", re.S)


class VendorMissing(Exception):
    pass


def _diagram_sources(markdown: str) -> list[str]:
    """The body of every block this shell hands to mermaid.

    A ```canvas block is not one of them. The canvas reads the nodes and edges itself and
    never calls mermaid, so such a block asks for no module.
    """
    return [m.group(3) for m in FENCE.finditer(markdown) if m.group(2) == "mermaid"]


def _head_word(src: str) -> str:
    """The first effective line of a block, lowercased and cut at its first separator.

    This is the same reading `app.js` does to decide whether a block goes on the canvas: a
    frontmatter block, an init directive, a comment and blank lines come before the line
    that says what the diagram is.
    """
    for line in BLOCK_FRONTMATTER.sub("", src).splitlines():
        line = line.strip()
        if not line or line.startswith("%%"):
            continue
        return re.split(r"[\s:;]", line, maxsplit=1)[0].lower()
    return ""


def needed_prefixes(markdown: str) -> tuple[list[str], list[str]]:
    """Module prefixes the document needs, and the head words that were not recognised.

    An unrecognised word is not an error. mermaid may have learned a diagram this table has
    not, so the caller bakes everything rather than baking a document that cannot draw.
    """
    prefixes: list[str] = []
    unknown: list[str] = []
    for src in _diagram_sources(markdown):
        word = _head_word(src)
        if not word:
            continue
        if word in DIAGRAM_MODULES:
            prefixes += DIAGRAM_MODULES[word]
        else:
            unknown.append(word)
        if "$$" in src:
            prefixes += KATEX_MODULES
    return prefixes, unknown


def bundle(vendor: pathlib.Path) -> str:
    """The whole of mermaid as one script, for a document the table cannot slice for."""
    path = vendor / BUNDLE
    if not path.exists():
        raise VendorMissing(f"source/vendor/mermaid/{BUNDLE} is missing.")
    return path.read_text(encoding="utf-8")


def _entry_module(vendor: pathlib.Path) -> str:
    """The chunk `mermaid.esm.min.mjs` re-exports, resolved rather than pinned by hash."""
    entry = vendor / ENTRY
    if not entry.exists():
        raise VendorMissing(f"source/vendor/mermaid/{ENTRY} is missing.")
    found = STATIC_IMPORT.search(entry.read_text(encoding="utf-8"))
    if not found:
        raise VendorMissing(f"source/vendor/mermaid/{ENTRY} imports nothing. the vendor is not mermaid's dist.")
    return found.group(2)


def _imports(vendor: pathlib.Path, name: str) -> tuple[set[str], set[str]]:
    text = (vendor / name).read_text(encoding="utf-8")
    return {m[1] for m in STATIC_IMPORT.findall(text)}, set(DYNAMIC_IMPORT.findall(text))


def select(vendor: pathlib.Path, prefixes: list[str]) -> list[str]:
    """Modules to bake, in an order where a module comes after everything it imports.

    The order matters because a module's blob URL is only known once it has been made, and a
    static import needs that URL written into the text.
    """
    root = _entry_module(vendor)
    _, dynamic = _imports(vendor, root)
    seeds = sorted(d for d in dynamic if any(d.startswith(p) for p in prefixes))

    reachable: set[str] = set()
    pending = [root, *seeds]
    while pending:
        name = pending.pop()
        if name in reachable:
            continue
        reachable.add(name)
        static, _ = _imports(vendor, name)
        pending += [n for n in static if n not in reachable]

    # mermaid's dist has no import cycle, so a plain post order is a valid load order.
    order: list[str] = []
    visited: set[str] = set()

    def visit(name: str) -> None:
        if name in visited:
            return
        visited.add(name)
        static, _ = _imports(vendor, name)
        for dep in sorted(static & reachable):
            visit(dep)
        order.append(name)

    for name in sorted(reachable):
        visit(name)
    return order


def runtime(vendor: pathlib.Path, modules: list[str]) -> str:
    """The script that puts mermaid on `window`, with only `modules` inside it.

    A static import is rewritten to a marker and resolved to the blob URL of the module it
    names when that text is turned into a blob, which is why `modules` has to be in load
    order. A dynamic import goes through `__mmdUrl` instead, because the diagram modules are
    loaded lazily and a diagram module can be made after the module that imports it.
    """
    root = _entry_module(vendor)
    payload = []
    for name in modules:
        text = (vendor / name).read_text(encoding="utf-8")
        text = STATIC_IMPORT.sub(lambda m: m.group(1) + json.dumps("mmd-blob:" + m.group(2)), text)
        text = DYNAMIC_IMPORT.sub(lambda m: "import(__mmdUrl(" + json.dumps(m.group(1)) + "))", text)
        payload.append([name, text])

    return (
        "var __MMD_MODULES = " + json.dumps(payload, ensure_ascii=False) + ";\n"
        + _LOADER.replace("__ROOT__", json.dumps(root)).replace("__EXPORT__", json.dumps(EXPORT))
    )


# A diagram type left out is not a broken document. The block falls back to its source, and
# the message says why.
_LOADER = """
(function () {
  var url = {};
  var missing = URL.createObjectURL(new Blob(
    ['throw new Error("this diagram type was not baked into this document")'],
    { type: 'text/javascript' }));

  window.__mmdUrl = function (name) { return url[name] || missing; };

  for (var i = 0; i < __MMD_MODULES.length; i++) {
    var name = __MMD_MODULES[i][0];
    var text = __MMD_MODULES[i][1].replace(/"mmd-blob:([^"]+)"/g, function (_, dep) {
      return JSON.stringify(url[dep] || missing);
    });
    url[name] = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  }

  window.__mermaidReady = import(url[__ROOT__]).then(function (module) {
    window.mermaid = module[__EXPORT__];
    return window.mermaid;
  });
})();
"""
