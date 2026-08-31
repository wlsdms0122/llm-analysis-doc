# analysis-doc

Use this to hand over analysis and design work. **Write one markdown file and bake it with a fixed shell.** Do not write HTML.

The output is a single HTML file with no external requests (3.4MB, marked and mermaid inlined). It carries a table of contents on the left, three views (document, source, canvas), mermaid diagrams, a flow canvas you can rearrange, and a way to get the markdown back out. It opens the same way on a corporate network, offline, or uploaded to Slack.

This directory is an open-package. The specification is `open-package spec`.

## Using it

```
open-package setup                        # once
open-package build <content.md> -o <out.html>
open-package verify                       # does it work here
```

Leave `-o` out and the output lands next to the input under the same name (`flow.md` becomes `flow.html`).

`setup` fetches marked 12.0.2 and mermaid 10.9.1 into `source/vendor/`. That is 3.2MB of someone else's code, so the package does not carry it. The versions and their sha256 are pinned, so the same bytes arrive wherever you fetch from. The shell inlines both files whole, so different bytes would change the output without saying so. What is fetched is not committed.

If a corporate network blocks the registry, do not work around it. Give it a mirror.

```
ADOC_VENDOR_BASE=https://<mirror>/npm open-package setup
```

Skip `setup` and `build` gives you the setup command instead of a stack trace.

## Syntax

`document/SYNTAX.md` is the SSoT for the full syntax and the canvas controls. `document/EXAMPLE.md` is a working example of every component, and new documents start by copying it. This is only a list of what exists.

- frontmatter: `title`, `kicker`, `subtitle`, `slug`. All optional. Without them the first `#` heading is used
- callouts: `:::note` `:::ok` `:::warn` `:::danger`. Text after the name is the title
- steps: `:::steps`
- two columns: `:::compare left | right`
- diagrams: ```mermaid. Rendered in the body, and put on the flow canvas when the first effective line is `graph` or `flowchart`
- canvas only graphs: ```canvas. Only a toolbar in the body, the drawing lives on the canvas
- call sequences: ```trace. Line prefixes are `-` call, `?` branch, `!` error, `+` success

Give a diagram its name directly after the fence, as in ```mermaid signing entry flow. That name is the caption, the name in the canvas list, and the address its layout is stored under. Without a name, or with a name already taken, the canvas opens read only. There is no fallback: a name derived from the heading would break the address the moment a section is renamed.

Everything inside a container uses the same syntax as the body, and containers nest.

## Writing the body

- The first section is **one line of conclusion**. Evidence comes after
- Attach measured coordinates to a claim: a file, a line number, an API path. A sentence without them is an impression
- When something is in opposition, web against native or expected against actual, put it in a `:::compare`. Prose makes the reader draw the table in their head
- Draw flow with `mermaid` `graph`. It goes on the flow canvas automatically, which puts the whole shape on one screen. Name the diagrams you intend to rearrange
- Keep what is unconfirmed and what needs a decision at the end, on their own. Do not mix analysis with requests for judgement

The markdown is **the original, not a discarded intermediate**. "Export MD" in the HTML hands back exactly that file, so keep both.

## Why the shell is fixed

If the page around the content changed per document, a reader would have to learn it again every time. There is one shell, and the only thing that changes per document is the markdown, so every analysis comes out with the same page. Change the shell and rebake everything.

For the same reason, **do not hand edit the HTML of an individual output.** Fix the markdown or the shell and bake it again.

The canvas follows the same rule. It is a window onto the document's diagrams rather than a separate model, so labels and structure are read only and owned by the markdown, and `localStorage` keeps only the presentation overlay: position, colour. Fix the markdown, bake again, and the canvas follows.

## What is in here

| path | what it is |
|---|---|
| `document/SYNTAX.md` | Syntax SSoT. Every component and the canvas controls |
| `document/EXAMPLE.md` | A working example of every component. The starting point for a new document |
| `source/build.py` | The builder. Markdown plus shell into a single HTML. Standard library only |
| `source/fetch-vendor.sh` | Fetches marked and mermaid. Pinned versions, sha256 checked |
| `source/verify.sh` | Bakes the example and checks size, self containment, and leftover placeholders |
| `source/template.html` | The page skeleton. Placeholders and nothing else |
| `source/app.js` | The runtime. Markdown preprocessing, component rendering, theme, flow canvas |
| `source/style.css` | Design tokens and layout, light and dark |
| `source/vendor/` | Fetched, not carried. See `setup` |

## Changing it

Raise `version` in `manifest.toml` when the syntax or the behaviour changes. Leave it alone for presentation only edits like typos and style numbers.

If you changed how `source/app.js` behaves, look at `document/SYNTAX.md` (the syntax) and this README (the summary) at the same time. Let the three disagree and someone writing a document will use syntax that does not exist. UI wording also lives in `source/template.html`.
