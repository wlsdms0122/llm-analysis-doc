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

# The entry of the minified ESM build, and the name it exports the mermaid object under.
ENTRY = "mermaid.esm.min.mjs"
EXPORT = "default"

# The UMD build of the same release: every diagram type, minified as one program, and it
# puts mermaid on `window` from a classic script. It is smaller than the modules for every
# type put together, because minifying across module boundaries is what a bundle can do and
# a set of published modules cannot.
BUNDLE = "mermaid.min.js"

# A specifier is relative to the module that writes it, and the modules sit two directories
# below the entry, so a name only means one module once it has been resolved against its
# importer. `_resolve` does that, and every name outside these patterns is the resolved one.
STATIC_IMPORT = re.compile(r'((?:from|import)\s*)"(\.[^"]*\.m?js)"')
DYNAMIC_IMPORT = re.compile(r'import\("(\.[^"]*\.m?js)"\)')

# The first word of a mermaid block against the modules that draw it. A module is named
# after the diagram, and the hash in the filename changes between mermaid releases, so the
# values here are filename prefixes rather than filenames.
#
# A type takes more than one module where mermaid splits it. The renderer is one, the parser
# another, and a diagram laid out by something other than dagre brings its own algorithm, so
# an entry names every piece its type reaches for.
#
# Five of the newer types are published under a name that is a hash and nothing else, so
# `diagram-` names all five renderers at once. They come to 43 KB together, which is less
# than the fallback costs a document that draws one of them.
DIAGRAM_MODULES = {
    "graph": ["flowDiagram-"],
    "flowchart": ["flowDiagram-"],
    "flowchart-v2": ["flowDiagram-"],
    "flowchart-elk": ["flowDiagram-"],
    "sequencediagram": ["sequenceDiagram-"],
    "classdiagram": ["classDiagram-v2-", "classDiagram-"],
    "classdiagram-v2": ["classDiagram-v2-"],
    "statediagram": ["stateDiagram-v2-", "stateDiagram-"],
    "statediagram-v2": ["stateDiagram-v2-"],
    "erdiagram": ["erDiagram-"],
    "journey": ["journeyDiagram-"],
    "gantt": ["ganttDiagram-"],
    "pie": ["pieDiagram-", "pie-"],
    "quadrantchart": ["quadrantDiagram-"],
    "requirement": ["requirementDiagram-"],
    "requirementdiagram": ["requirementDiagram-"],
    "gitgraph": ["gitGraphDiagram-", "gitGraph-"],
    "c4context": ["c4Diagram-"],
    "mindmap": ["mindmap-definition-", "cose-bilkent-"],
    "timeline": ["timeline-definition-"],
    "kanban": ["kanban-definition-"],
    "sankey": ["sankeyDiagram-"],
    "sankey-beta": ["sankeyDiagram-"],
    "xychart": ["xychartDiagram-"],
    "xychart-beta": ["xychartDiagram-"],
    "block": ["blockDiagram-"],
    "block-beta": ["blockDiagram-"],
    "info": ["infoDiagram-", "info-"],
    "architecture": ["architectureDiagram-", "architecture-"],
    "architecture-beta": ["architectureDiagram-", "architecture-"],
    "swimlane-beta": ["swimlanesDiagram-", "swimlanes-"],
    "ishikawa": ["ishikawaDiagram-"],
    "ishikawa-beta": ["ishikawaDiagram-"],
    "venn-beta": ["vennDiagram-"],
    "wardley-beta": ["wardleyDiagram-", "wardley-"],
    "cynefin-beta": ["cynefinDiagram-", "cynefin-"],
    "railroad-beta": ["railroadDiagram-", "railroad-"],
    "railroad-ebnf-beta": ["ebnfDiagram-", "railroad-ebnf-"],
    "railroad-abnf-beta": ["abnfDiagram-", "railroad-abnf-"],
    "railroad-peg-beta": ["pegDiagram-", "railroad-peg-"],
    "packet": ["diagram-", "packet-"],
    "packet-beta": ["diagram-", "packet-"],
    "radar-beta": ["diagram-", "radar-"],
    "treemap": ["diagram-", "treemap-"],
    "treeview-beta": ["diagram-", "treeView-"],
    "eventmodeling": ["diagram-", "eventmodeling-"],
}

# dagre lays out most of the types above and is lazy the same way they are. It comes to 11 KB
# and which types reach for it is not something the vendor states, so every document that
# draws anything gets it.
LAYOUT_MODULES = ["dagre-"]

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
            prefixes += DIAGRAM_MODULES[word] + LAYOUT_MODULES
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
    entry = vendor / ENTRY
    if not entry.exists():
        raise VendorMissing(f"source/vendor/mermaid/{ENTRY} is missing.")
    return ENTRY


def _resolve(importer: str, spec: str) -> str:
    """A relative specifier as a name under `vendor/mermaid/`."""
    return (pathlib.PurePosixPath(importer).parent / spec).as_posix()


def _imports(vendor: pathlib.Path, name: str) -> tuple[set[str], set[str]]:
    text = (vendor / name).read_text(encoding="utf-8")
    return ({_resolve(name, m[1]) for m in STATIC_IMPORT.findall(text)},
            {_resolve(name, m) for m in DYNAMIC_IMPORT.findall(text)})


def select(vendor: pathlib.Path, prefixes: list[str]) -> list[str]:
    """Modules to bake, in an order where a module comes after everything it imports.

    The order matters because a module's blob URL is only known once it has been made, and a
    static import needs that URL written into the text.
    """
    root = _entry_module(vendor)

    def named(name: str, patterns: list[str]) -> bool:
        base = pathlib.PurePosixPath(name).name
        return any(base.startswith(p) for p in patterns)

    # A wanted module is looked for in every module reached, not in the entry alone. mermaid
    # keeps three registries of lazy loaders and only one of them sits in the entry: the
    # diagram types are there, the parsers and the layout algorithms are each behind a chunk
    # of their own.
    reachable: set[str] = set()
    pending = [root]
    while pending:
        name = pending.pop()
        if name in reachable:
            continue
        reachable.add(name)
        static, dynamic = _imports(vendor, name)
        pending += [n for n in static if n not in reachable]
        pending += [n for n in dynamic if n not in reachable and named(n, prefixes)]

    # A prefix that named nothing means the table and the vendor have drifted apart. The
    # document would be baked without the module and the diagram it belongs to draws as
    # mermaid's error picture, which the build cannot see.
    missed = [p for p in dict.fromkeys(prefixes) if not any(named(n, [p]) for n in reachable)]
    if missed:
        raise VendorMissing(
            "no module in source/vendor/mermaid/ is named " + ", ".join(missed)
            + ". the table in mermaid_slice.py and this mermaid release disagree.")

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
        text = STATIC_IMPORT.sub(
            lambda m: m.group(1) + json.dumps("mmd-blob:" + _resolve(name, m.group(2))), text)
        text = DYNAMIC_IMPORT.sub(
            lambda m: "import(__mmdUrl(" + json.dumps(_resolve(name, m.group(1))) + "))", text)
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
