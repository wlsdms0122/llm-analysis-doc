/* analysis-doc runtime. The fixed shell.
 * In: base64 markdown inside <script id="doc-src">, plus window.DOC_META.
 * Out: table of contents or inspector on the left, body or canvas on the right.
 * The only thing that changes per document is the markdown. This file is the same everywhere.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- utils
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var ICON = {
    zoomIn: '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14M5 7h4M7 5v4"/></svg>',
    zoomOut: '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14M5 7h4"/></svg>',
    fit: '<svg viewBox="0 0 16 16"><path d="M2 5.5V2.5h3M14 5.5V2.5h-3M2 10.5v3h3M14 10.5v3h-3"/></svg>',
    expand: '<svg viewBox="0 0 16 16"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9"/></svg>',
    close: '<svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>',
    download: '<svg viewBox="0 0 16 16"><path d="M8 2v8"/><path d="M4.5 7L8 10.5 11.5 7"/><path d="M2.5 13.5h11"/></svg>',
    sun: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1 1M11.9 11.9l1 1M12.9 3.1l-1 1M4.1 11.9l-1 1"/></svg>',
    moon: '<svg viewBox="0 0 16 16"><path d="M13.5 9.6A5.8 5.8 0 016.4 2.5a5.8 5.8 0 107.1 7.1z"/></svg>',
    auto: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 010 11z" fill="currentColor" stroke="none"/></svg>',
    code: '<svg viewBox="0 0 16 16"><path d="M6 3L2 8l4 5"/><path d="M10 3l4 5-4 5"/></svg>',
    copy: '<svg viewBox="0 0 16 16"><rect x="5.5" y="1.5" width="9" height="9" rx="1.5"/><path d="M10.5 13.5h-8a1 1 0 01-1-1v-8"/></svg>',
    caret: '<svg viewBox="0 0 16 16" class="dd-caret"><path d="M4 6.5L8 10.5 12 6.5"/></svg>',
    grip: '<svg viewBox="0 0 16 16" class="grip"><circle cx="6" cy="4" r="1.1"/><circle cx="10" cy="4" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12" r="1.1"/><circle cx="10" cy="12" r="1.1"/></svg>',
    canvas: '<svg viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="5" height="3.5" rx="1"/><rect x="9.5" y="2.5" width="5" height="3.5" rx="1"/><rect x="5.5" y="10" width="5" height="3.5" rx="1"/><path d="M4 6v2h8V6M8 8v2"/></svg>',
    chevronUp: '<svg viewBox="0 0 16 16"><path d="M4 10L8 6l4 4"/></svg>',
    chevronDown: '<svg viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></svg>'
  };

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }

  function download(name, text, mime) {
    var b = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // The clipboard only exists in a secure context. Without it, fail quietly and fall back
  function copyText(s) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(s);
      }
    } catch (e) { }
    return Promise.reject(new Error('clipboard unavailable'));
  }

  function slug(s) {
    return String(s).trim().toLowerCase()
      .replace(/[`*_~]/g, '')
      .replace(/[^\w\u3130-\u318f\uac00-\ud7a3\- ]+/g, '')
      .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'sec';
  }

  // ---------------------------------------------------------------- theme repaint registry
  // Most surfaces take the CSS variables and follow the theme on their own. The ones that
  // cannot, the SVG mermaid emits and the raster minimap, bake colours in as values and
  // have to redraw themselves when the theme changes. Registering here is what paintTheme
  // calls. Naming each surface at the call site would mean editing that site every time a
  // surface is added, and that is exactly how the minimap got left out.
  var REPAINT = [];
  function onRepaint(fn) { REPAINT.push(fn); }

  // ---------------------------------------------------------------- source load
  var META = window.DOC_META || {};
  var SRC = '';
  try {
    var raw = document.getElementById('doc-src').textContent.replace(/\s+/g, '');
    var bin = atob(raw);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    SRC = new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    SRC = '# failed to load\n\n' + String(e);
  }

  // ---------------------------------------------------------------- block preprocessing
  var BLOCKS = [];
  // Placeholders are wrapped in private use characters. Sharing a namespace with ordinary
  // text means a placeholder shaped string written inside a code block turns into someone
  // else's block when placeholders are resolved. Worse, if that block contains the string,
  // resolving plants itself again and grows without end. Splitting the namespace is not
  var SENT = '\ue000';
  // Front branch = the placeholder has the paragraph to itself. The <p> has to come out with
  // it or the block stays inside the paragraph. marked strips only as far as the content
  // column of a list item, so leftover spaces disagree with the original indent. If that
  var MARK_RE = new RegExp('<p>\\s*' + SENT + 'ADBLOCK(\\d+)' + SENT + '\\s*</p>|' + SENT + 'ADBLOCK(\\d+)' + SENT, 'g');
  // left out of the test.
  // A placeholder inherits the indentation of the block it replaces. Dropped to column 0,
  // marked reads the list item as having ended there and cuts the list in two.
  // The original is passed through as is. Trimming columns splits the list at a `10. ` item
  // (4 columns) and at two levels of nesting (4 columns). Whether 4 columns is indented code
  function stash(html, indent) {
    BLOCKS.push(html);
    return '\n\n' + (indent || '') + SENT + 'ADBLOCK' + (BLOCKS.length - 1) + SENT + '\n\n';
  }

  // SRC is left alone. "Export MD" has to be the file the build used, byte for byte.
  var BODY = SRC
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .split(SENT).join('');

  var GRAPHS = [];
  var GRAPH_KEY_SEEN = {};

  // The address of an overlay (position, colour) comes only from a name given directly on
  // the fence. A diagram the document never named has no address, and inventing one puts a
  // layout on somebody else's diagram. Order of appearance shifts as soon as one diagram is
  // inserted, and a heading is a position rather than a name, so it disappears the moment a
  function registerGraph(name, src, heading) {
    var key = name ? slug(name) : '';
    // A name given twice cannot make either one the owner of that address. The first one keeps it.
    var taken = key && GRAPH_KEY_SEEN[key];
    if (key) GRAPH_KEY_SEEN[key] = true;
    GRAPHS.push({
      title: (name || heading || 'graph ' + (GRAPHS.length + 1)),
      heading: heading || '',
      src: src,
      key: taken ? '' : key,
      // Why there is no address. The badge says it out loud.
      lock: key ? (taken ? 'dup' : '') : 'unnamed'
    });
    return GRAPHS.length - 1;
  }

  // A diagram with no name inherits the section name, so several diagrams in one section
  // sharing a title is normal. The only problem is not being able to tell them apart in the
  // list, so what gets disambiguated is the *display name* alone. The overlay address (key)
  // keeps the order of appearance rule. Changing the key here would take the address away
  function labelGraphs() {
    var total = {}, seen = {};
    GRAPHS.forEach(function (g) { total[g.title] = (total[g.title] || 0) + 1; });
    GRAPHS.forEach(function (g) {
      if (total[g.title] < 2) { g.label = g.title; return; }
      var n = (seen[g.title] = (seen[g.title] || 0) + 1);
      g.label = g.title + ' (' + n + ')';
    });
  }

  // What a mermaid block is gets decided by its first *effective* line. Frontmatter, init
  // directives, comments and blank lines before it are not declarations. Reading only the
  // very start of the text drops a flowchart carrying `%%{init:...}%%` out of the canvas,
  function mermaidHead(src) {
    // A directive can span lines, so removing line by line lets an inner line pose as the declaration.
    var lines = String(src).replace(/%%\{[\s\S]*?\}%%/g, '').split('\n');
    var i = 0;
    // It is frontmatter only when it opens with `---`. A `---` in the middle of the body is
    if (/^\s*---\s*$/.test(lines[0] || '')) {
      for (i = 1; i < lines.length && !/^\s*---\s*$/.test(lines[i]); i++);
      i++;
    }
    for (; i < lines.length; i++) {
      var line = lines[i].replace(/%%\{[\s\S]*?\}%%/g, '').replace(/%%.*$/, '').trim();
      if (line) return line;
    }
    return '';
  }

  // The canvas does not render mermaid. It reads the nodes and edges and lays them out
  // itself. parseGraph knows one syntax, flowchart, so a diagram on a different axis
  function canvasKind(src) {
    var head = mermaidHead(src);
    if (/^(graph|flowchart)\b/i.test(head)) return '';
    return (head.match(/^[\w-]+/) || ['diagram'])[0];
  }

  // Single owner of the block boundary rules.
  // "Nothing inside a block is read with the outside syntax" is the invariant of the whole
  // preprocessor. Implementing it separately everywhere lines are walked means one missed
  // spot lets a `:::` or `---` inside a code block or a nested container shake the outer
  var FENCE_RE = /^\s*(`{3,}|~{3,})[ \t]*([\w-]*)[ \t]*(.*?)[ \t]*$/;
  var OPEN_RE = /^\s*:::+\s*([\w-]+)\s*(.*)$/;
  var CLOSE_RE = /^\s*:::+\s*$/;
  var HEAD_RE = /^\s*#{1,6}\s+(.+)$/;
  var LIST_RE = /^\s*([-*+]|\d{1,9}[.)])\s+/;
  function indentOf(line) { return line.match(/^\s*/)[0].length; }

  // A closing fence has to be at least as long as the opening one, in the same character (CommonMark).
  function fenceCloseRe(marker) {
    return new RegExp('^\\s*' + marker[0] + '{' + marker.length + ',}\\s*$');
  }

  // Indentation is read against the *content column of the current list item*, not the
  // absolute column. marked reads it that way too. Four columns at the top level is indented
  // code, but four columns inside a `10. ` item is just that item's body. Judged by absolute
  function baseCols(lines) {
    var base = [], cols = [], i;
    for (i = 0; i < lines.length; i++) {
      var top = cols.length ? cols[cols.length - 1] : 0;
      if (!/^\s*$/.test(lines[i])) {
        var ind = indentOf(lines[i]);
        while (cols.length && ind < cols[cols.length - 1]) cols.pop();
        top = cols.length ? cols[cols.length - 1] : 0;
        var lm = lines[i].match(LIST_RE);
        base.push(top);
        if (lm) cols.push(lm[0].length);
        continue;
      }
      base.push(top);
    }
    return base;
  }
  // A line four or more columns past the content column is indented code, not block syntax.
  function tooDeep(lines, i, base) { return indentOf(lines[i]) - base[i] >= 4; }

  // The match, if lines[i] opens a fence. Otherwise null.
  function fenceAt(lines, i, base) {
    if (tooDeep(lines, i, base)) return null;
    return lines[i].match(FENCE_RE);
  }

  // Computes the block boundaries of one array of lines in a single pass.
  //   span[i] = { end, closed }. The index past the end of the block starting at i (a fence
  //             or a ::: container) and whether it closed. null when no block starts there.
  // Letting a single `-1` mean both "not a block" and "never closed" makes every consumer
  // reproduce that distinction, and splitColumns walked straight into an unclosed fence
  //
  // Recursing per line to rescan ahead makes the calls grow 2^n when unclosed `:::` lines
  // follow each other (measured: 8.38 million calls over 24 lines). One pass with a stack.
  // span carries meaning rather than regex group numbers, so a consumer does not have to
  function fenceSpan(m, end, closed) {
    return { kind: 'fence', end: end, closed: closed,
             marker: m[1], lang: (m[2] || '').toLowerCase(), cap: m[3] };
  }
  function containerSpan(m, end, closed) {
    return { kind: 'container', end: end, closed: closed,
             name: m[1].toLowerCase(), arg: m[2] || '' };
  }
  function headingSpan(m, end) {
    return { kind: 'heading', end: end, closed: true,
             text: m[1].replace(/[`*]/g, '').trim() };
  }

  function blockSpans(lines) {
    var base = baseCols(lines), span = [], stack = [], i;
    for (i = 0; i < lines.length; i++) span.push(null);
    i = 0;
    while (i < lines.length) {
      var fm = fenceAt(lines, i, base);
      if (fm) {
        // A fence sits below our `:::`. Its partner is looked for across the whole slice.
        // Stopping at the container's closing line means the moment a code block inside a
        // callout demonstrates the `:::` syntax, which is what the README actually does,
        // that example closes the container.
        // The closing line goes through the same gate as the opening one. Matching on `^\s*`
        // alone accepts a backtick indented four or more columns past the content column,
        var close = fenceCloseRe(fm[1]);
        for (var j = i + 1; j < lines.length && !(!tooDeep(lines, j, base) && close.test(lines[j])); j++);
        if (j < lines.length) {
          span[i] = fenceSpan(fm, j + 1, true);
          i = j + 1; continue;
        }
        // Only a fence with no partner at all is confined to the enclosing block, so a typo
        var limit = lines.length;
        if (stack.length) {
          for (var c = i + 1; c < lines.length; c++) {
            if (!tooDeep(lines, c, base) && CLOSE_RE.test(lines[c])) { limit = c; break; }
          }
        }
        span[i] = fenceSpan(fm, limit, false);
        i = limit;
        continue;
      }
      if (!tooDeep(lines, i, base)) {
        var om = lines[i].match(OPEN_RE);
        if (om) { stack.push({ at: i, m: om }); i++; continue; }
        if (stack.length && CLOSE_RE.test(lines[i])) {
          var top = stack.pop();
          span[top.at] = containerSpan(top.m, i + 1, true);
          i++; continue;
        }
        var hm = lines[i].match(HEAD_RE);
        if (hm) { span[i] = headingSpan(hm, i + 1); i++; continue; }
      }
      i++;
    }
    // A container never closed. Not accepted as a block, but its end is still reported.
    while (stack.length) {
      var left = stack.pop();
      span[left.at] = containerSpan(left.m, lines.length, false);
    }
    return span;
  }

  // A container body is reparsed on its own, without the outer list context. Handed over
  // with the original indentation, the inner marked sees four columns at the top level,
  // which is indented code. Exactly as much as the opening line is stripped, no more.
  function dedent(arr, pad) {
    if (!pad) return arr;
    var loose = new RegExp('^\\s{0,' + pad.length + '}');
    return arr.map(function (l) {
      return l.slice(0, pad.length) === pad ? l.slice(pad.length) : l.replace(loose, '');
    });
  }

  // Headings go in and come back out. The outer heading is handed into the container, or the
  // inner graphs lose their name, and the last heading seen inside is returned outward.
  // Without returning it, the outer pass would rescan the body, there would be two gates,
  // and a raw scan picks up `#` inside code blocks.
  function preprocess(md, heading) {
    var lines = md.split('\n');
    var span = blockSpans(lines);
    var out = [];
    var lastHeading = heading || '';
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      // What a line is gets decided by blockSpans. Matching the same regex again here makes
      // two gates, and fixing only one of them gives two owners different answers.
      var sp = span[i];

      if (sp && sp.kind === 'heading') {
        lastHeading = sp.text;
        out.push(line); i++; continue;
      }

      if (sp && sp.kind === 'fence') {
        var marker = sp.marker, lang = sp.lang, cap = sp.cap;
        var indent = line.slice(0, indentOf(line));
        var body = lines.slice(i + 1, sp.closed ? sp.end - 1 : sp.end);
        i = sp.end;
        var text = body.join('\n');
        if (lang === 'mermaid') {
          var kind = canvasKind(text);
          var gi = kind ? -1 : registerGraph(cap, text, lastHeading);
          // The caption carries only what the document called this diagram. Called nothing,
          // it stays empty. Pulling the heading in just repeats the title directly above it.
          out.push(stash(renderMermaidFigure(text, cap, gi), indent));
        } else if (lang === 'canvas') {
          var gi2 = registerGraph(cap, text, lastHeading);
          out.push(stash(renderCanvasStub(cap, text, gi2), indent));
        } else if (lang === 'trace' || lang === 'seq') {
          out.push(stash(renderSeq(text), indent));
        } else {
          out.push(line);
          out.push.apply(out, body);
          // The closing line inherits the opening line's indentation. Dropped to column 0,
          // cuts the list item and opens a new fence, turning the rest of the document into a code block.
          if (sp.closed) out.push(indent + marker);
        }
        continue;
      }

      // An unclosed `:::` is not a container. It goes through as an ordinary line.
      // Swallowing to the end of the document here puts everything after one typo inside a callout.
      if (sp && sp.kind === 'container' && sp.closed) {
        var pad = line.slice(0, indentOf(line));
        var buf = dedent(lines.slice(i + 1, sp.end - 1), pad);
        i = sp.end;
        // A heading inside a container belongs to this document too, and the recursion has
        // already worked it out. Rescanning buf outside would pick up `#` inside code blocks.
        var made = renderContainer(sp.name, sp.arg, buf.join('\n'), lastHeading);
        out.push(stash(made.html, pad));
        lastHeading = made.heading;
        continue;
      }

      out.push(line); i++;
    }
    return { md: out.join('\n'), heading: lastHeading };
  }

  // ---------------------------------------------------------------- component renderers
  function mdInline(s) { return marked.parseInline(String(s || '')); }

  var CALLOUT_ICON = { note: '◆', info: '◆', ok: '✓', tip: '✓', warn: '▲', danger: '■' };

  // A container body uses the same syntax as the document body. Without the preprocessor,
  // a mermaid or trace block inside ::: falls through as a plain code block and never
  // reaches the canvas. Returns { html, heading }, carrying the last heading seen inside upward.
  function mdNested(s, heading) {
    var r = preprocess(String(s || ''), heading);
    return { html: marked.parse(r.md), heading: r.heading };
  }

  // Only the --- that separates the two columns of :::compare. A --- inside a block (the
  // frontmatter of a code block, a YAML example, a nested container body) is skipped, and
  // **only the first separator** is used. Cutting on all of them loses everything from the third piece on.
  function splitColumns(body) {
    var lines = String(body || '').split('\n');
    var span = blockSpans(lines);
    var seps = [], i = 0;
    while (i < lines.length) {
      if (span[i]) { i = span[i].end; continue; }   // an unclosed block is still a block, so do not walk in
      if (/^\s*---\s*$/.test(lines[i])) seps.push(i);
      i++;
    }
    if (!seps.length) return [lines.join('\n'), ''];
    // A leftover separator becomes a setext h2 when the line above is a paragraph, putting a
    // heading nobody wrote into the contents. It means a horizontal rule, so make it one.
    for (var k = 1; k < seps.length; k++) lines[seps[k]] = '***';
    return [lines.slice(0, seps[0]).join('\n'), lines.slice(seps[0] + 1).join('\n')];
  }

  // Returns { html, heading }, handing the inner heading back to the caller.
  function renderContainer(kind, arg, body, heading) {
    if (kind === 'steps') {
      // Operating on the generated HTML with a regex catches only the first match and misses
      // `<ol start="3">`. Wrap it and leave the styling to a CSS descendant selector.
      var st = mdNested(body, heading);
      return { html: '<div class="steps">' + st.html + '</div>', heading: st.heading };
    }
    if (kind === 'compare') {
      var heads = arg.split('|');
      var parts = splitColumns(body);
      // The two columns run in document order. A seeds B's heading, and B, being later, wins.
      var a = mdNested(parts[0] || '', heading);
      var b = mdNested(parts[1] || '', a.heading);
      return {
        html: '<div class="compare">' +
          '<div class="compare-col a"><div class="compare-head">' + esc((heads[0] || 'A').trim()) + '</div>' +
          '<div class="compare-body">' + a.html + '</div></div>' +
          '<div class="compare-col b"><div class="compare-head">' + esc((heads[1] || 'B').trim()) + '</div>' +
          '<div class="compare-body">' + b.html + '</div></div></div>',
        heading: b.heading
      };
    }
    var k = ({ info: 'note', tip: 'ok' })[kind] || kind;
    if (!/^(note|ok|warn|danger)$/.test(k)) k = 'note';
    var title = arg.trim();
    var co = mdNested(body, heading);
    return {
      html: '<div class="callout ' + k + '">' +
        (title ? '<div class="callout-title"><span>' + CALLOUT_ICON[k] + '</span>' + mdInline(title) + '</div>' : '') +
        co.html + '</div>',
      heading: co.heading
    };
  }

  var mermaidSeq = 0;
  function renderMermaidFigure(src, caption, gi) {
    var id = 'mmd' + (mermaidSeq++);
    return '<div class="figure" data-mermaid="' + id + '">' +
      '<div class="figure-bar">' +
        // The caption of a named diagram has to match the list name, and that name (with its
        // duplicate number) is only settled after the whole document is walked. Leave the slot and fill it after rendering.
        '<span class="cap"' + (gi >= 0 ? ' data-gi="' + gi + '"' : '') + '>' +
        esc(caption || '') + '</span><span class="sp"></span>' +
        (gi >= 0 ? '<button data-act="canvas" data-gi="' + gi + '" title="Show on the flow canvas">' + ICON.canvas + '</button>' : '') +
        '<button class="zoom-only" data-act="zout" title="Zoom out">' + ICON.zoomOut + '</button>' +
        '<span class="zlabel zoom-only">100%</span>' +
        '<button class="zoom-only" data-act="zin" title="Zoom in">' + ICON.zoomIn + '</button>' +
        '<button class="zoom-only" data-act="zfit" title="Fit">' + ICON.fit + '</button>' +
        '<button data-act="src" title="Show the mermaid source">' + ICON.code + '</button>' +
        '<button class="src-only" data-act="copysrc" title="Copy the mermaid source">' + ICON.copy + '</button>' +
        '<button data-act="svg" title="Download the SVG">' + ICON.download + '</button>' +
        '<button data-act="zoom" title="Enlarge">' + ICON.expand + '</button>' +
      '</div>' +
      '<div class="figure-body"><pre class="mermaid-src"><code>' + esc(src) + '</code></pre>' +
      '<div class="mermaid-out" id="' + id + '"></div></div></div>';
  }

  // The mark left by a graph that is not drawn in the body. Same toolbar as a figure, no body.
  // It is a block of the same syntax so it gets the same handles (go to canvas, show source). The only difference is that nothing is drawn.
  function renderCanvasStub(title, src, gi) {
    return '<div class="figure canvas-only">' +
      '<div class="figure-bar">' +
        '<span class="cap"' + (gi >= 0 ? ' data-gi="' + gi + '"' : '') + '>' + esc(title || '') + '</span>' +
        '<span class="sp"></span>' +
        '<button data-act="canvas" data-gi="' + gi + '" title="Show on the flow canvas">' + ICON.canvas + '</button>' +
        '<button data-act="src" title="Show the mermaid source">' + ICON.code + '</button>' +
        '<button class="src-only" data-act="copysrc" title="Copy the mermaid source">' + ICON.copy + '</button>' +
      '</div>' +
      '<div class="figure-body"><pre class="mermaid-src"><code>' + esc(src) + '</code></pre></div></div>';
  }

  function renderSeq(src) {
    var lines = src.split('\n'), title = '', steps = [];
    lines.forEach(function (l) {
      if (!l.trim()) return;
      var t = l.match(/^\s*title\s*:\s*(.+)$/i);
      if (t) { title = t[1]; return; }
      var m = l.match(/^\s*([-!?+])\s+(.*)$/);
      if (!m) return;
      var kind = { '-': 'call', '!': 'error', '?': 'branch', '+': 'ok' }[m[1]];
      var f = m[2].split('|');
      steps.push({ kind: kind, actor: (f[0] || '').trim(), what: (f[1] || '').trim(), note: (f[2] || '').trim() });
    });
    if (!steps.length) return '<pre><code>' + esc(src) + '</code></pre>';
    var html = '<div class="seq">' +
      (title ? '<div class="seq-head">' + esc(title) + '</div>' : '') + '<ol class="seq-list">';
    steps.forEach(function (s) {
      html += '<li class="seq-step" data-kind="' + s.kind + '">' +
        '<div class="seq-actor">' + esc(s.actor) + '</div>' +
        '<div><div class="seq-what">' + mdInline(s.what) + '</div>' +
        (s.note ? '<div class="seq-note">' + mdInline(s.note) + '</div>' : '') + '</div></li>';
    });
    return html + '</ol></div>';
  }

  // ---------------------------------------------------------------- graph parser
  // Takes mermaid flowchart node shape notation as it is.
  var SHAPE_PATTERNS = [
    [/^\(\(\((.*)\)\)\)$/, 'doublecircle'],
    [/^\(\((.*)\)\)$/, 'circle'],
    [/^\(\[(.*)\]\)$/, 'stadium'],
    [/^\[\((.*)\)\]$/, 'cylinder'],
    [/^\{\{(.*)\}\}$/, 'hexagon'],
    [/^\[\[(.*)\]\]$/, 'subroutine'],
    [/^\[\/(.*)\\\]$/, 'trapezoid'],
    [/^\[\\(.*)\/\]$/, 'trapezoid'],
    [/^\[\/(.*)\/\]$/, 'parallelogram'],
    [/^\[\\(.*)\\\]$/, 'parallelogram'],
    [/^\{(.*)\}$/, 'diamond'],
    [/^\((.*)\)$/, 'round'],
    [/^\[(.*)\]$/, 'rect'],
    [/^>(.*)\]$/, 'round']
  ];

  // mermaid's `@{ shape: ... }` names, against the shapes the canvas draws. A name outside
  // this table becomes a rectangle, which is what a shape carrying no meaning here should
  // look like.
  var SHAPE_ALIASES = {
    rounded: 'round', event: 'round',
    stadium: 'stadium', terminal: 'stadium', pill: 'stadium',
    'fr-rect': 'subroutine', subprocess: 'subroutine', subproc: 'subroutine',
    'framed-rectangle': 'subroutine', subroutine: 'subroutine',
    cyl: 'cylinder', db: 'cylinder', database: 'cylinder', cylinder: 'cylinder',
    'h-cyl': 'cylinder', das: 'cylinder', 'horizontal-cylinder': 'cylinder',
    'lin-cyl': 'cylinder', disk: 'cylinder', 'lined-cylinder': 'cylinder',
    circle: 'circle', circ: 'circle',
    'sm-circ': 'circle', start: 'circle', 'small-circle': 'circle',
    'f-circ': 'circle', junction: 'circle', 'filled-circle': 'circle',
    'dbl-circ': 'doublecircle', 'double-circle': 'doublecircle',
    'fr-circ': 'doublecircle', stop: 'doublecircle', 'framed-circle': 'doublecircle',
    diam: 'diamond', decision: 'diamond', diamond: 'diamond', question: 'diamond',
    hex: 'hexagon', hexagon: 'hexagon', prepare: 'hexagon',
    'lean-r': 'parallelogram', 'lean-right': 'parallelogram', 'in-out': 'parallelogram',
    'lean-l': 'parallelogram', 'lean-left': 'parallelogram', 'out-in': 'parallelogram',
    'trap-b': 'trapezoid', priority: 'trapezoid', 'trapezoid-bottom': 'trapezoid',
    trapezoid: 'trapezoid', 'trap-t': 'trapezoid', manual: 'trapezoid',
    'trapezoid-top': 'trapezoid', 'inv-trapezoid': 'trapezoid'
  };

  var META = /^@\{(.*)\}$/;
  var META_ENTRY = /([\w-]+)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^,}]*))/g;

  // The keys mermaid takes in `@{ ... }` beyond these two name things the canvas has no way
  // to draw, such as an icon or an image.
  function parseMeta(body) {
    var read = { shape: null, label: null }, m;
    META_ENTRY.lastIndex = 0;
    while ((m = META_ENTRY.exec(body))) {
      var key = m[1].toLowerCase();
      var value = (m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] || '').trim();
      if (key === 'shape') read.shape = SHAPE_ALIASES[value.toLowerCase()] || 'rect';
      else if (key === 'label') read.label = value;
    }
    return read;
  }

  function parseToken(tok, g, group) {
    tok = tok.trim();
    if (!tok) return null;
    var m = tok.match(/^([\w.$-]+)\s*(.*)$/);
    if (!m) return null;
    var id = m[1], rest = m[2].trim(), shape = null, label = null;
    var meta = rest.match(META);
    if (meta) {
      var read = parseMeta(meta[1]);
      shape = read.shape;
      label = read.label;
    } else {
      for (var i = 0; i < SHAPE_PATTERNS.length; i++) {
        var r = rest.match(SHAPE_PATTERNS[i][0]);
        if (r) { shape = SHAPE_PATTERNS[i][1]; label = r[1]; break; }
      }
    }
    if (label != null) label = stripQuotes(label);
    if (!g.map[id]) {
      g.map[id] = { id: id, label: (label != null ? label : id), shape: shape || 'rect', group: group };
      g.nodes.push(g.map[id]);
    } else if (label != null) {
      g.map[id].label = label;
      if (shape) g.map[id].shape = shape;
    }
    // A node named before any subgraph and used inside one belongs to that subgraph. The
    // first subgraph to name it keeps it, which is what mermaid draws.
    if (group && !g.map[id].group) g.map[id].group = group;
    return id;
  }

  function stripQuotes(s) { return String(s).replace(/^"(.*)"$/, '$1').replace(/<br\s*\/?>/gi, ' '); }

  function parseGraph(src, seed) {
    var g = seed || { nodes: [], edges: [], map: {} };
    // Subgraphs nest, so the open ones are a stack and a node belongs to the innermost one.
    // Emptying the name at `end` takes the outer group off every member that follows it.
    var open = [];
    function group() { return open[open.length - 1] || ''; }
    // `id@{ ... }` may be written over several lines, one entry to a line. Folding it onto a
    // single line keeps the rest of the parser reading a line at a time, and the line break
    // becomes the comma that separates two entries written side by side.
    var text = String(src).replace(/@\{[^}]*\}/g, function (block) {
      return block.replace(/\s*\n\s*/g, ', ');
    });
    // `A e1@--> B` names the edge. The canvas has no edge ids, and holding the names keeps a
    // later `e1@{ ... }` from being read as a node of its own.
    var edgeIds = {};
    text.split('\n').forEach(function (rawLine) {
      var line = rawLine.replace(/%%.*$/, '').trim();
      if (!line) return;
      if (/^(graph|flowchart)\b/i.test(line)) return;
      if (/^(classDef|class|style|linkStyle|click|direction)\b/i.test(line)) return;
      var sg = line.match(/^subgraph\s+(.+)$/i);
      if (sg) { open.push(stripQuotes(sg[1].replace(/^[\w-]+\s*\[(.*)\]$/, '$1')).trim()); return; }
      if (/^end$/i.test(line)) { open.pop(); return; }

      var re = /\s*(-{2,}>|-\.->|={2,}>|-{2,}|-\.-|={2,})\s*/g;
      var pieces = [], links = [], last = 0, m;
      while ((m = re.exec(line))) { pieces.push(line.slice(last, m.index)); links.push(m[0].trim()); last = m.index + m[0].length; }
      pieces.push(line.slice(last));

      if (pieces.length === 1) {
        var solo = pieces[0].match(/^\s*([\w.$-]+)@\{/);
        if (!(solo && edgeIds[solo[1]])) parseToken(pieces[0], g, group());
        return;
      }

      var prev = null;
      for (var i = 0; i < pieces.length; i++) {
        var piece = pieces[i], edgeLabel = '';
        var lm = piece.match(/^\s*\|([^|]*)\|\s*/);
        if (lm) { edgeLabel = stripQuotes(lm[1]); piece = piece.slice(lm[0].length); }
        var named = piece.match(/\s([\w.-]+)@\s*$/);
        if (named) { edgeIds[named[1]] = true; piece = piece.slice(0, named.index); }
        var id = parseToken(piece, g, group());
        if (id == null) {
          if (piece.trim() && prev != null) links[i] = piece.trim();
          continue;
        }
        if (prev != null) {
          var link = links[i - 1] || '';
          g.edges.push({
            from: prev, to: id,
            label: edgeLabel || labelOf(link),
            style: /\./.test(link) ? 'dashed' : 'solid',
            width: /=/.test(link) ? '2' : '1'
          });
        }
        prev = id;
      }
    });
    return g;
  }

  function labelOf(tok) { return /^[-=.>]+$/.test(String(tok || '')) ? '' : String(tok || '').trim(); }

  // ---------------------------------------------------------------- render pipeline
  marked.setOptions({ gfm: true, breaks: false, mangle: false, headerIds: false });

  var processed = preprocess(BODY).md;
  labelGraphs();
  var html = marked.parse(processed);
  // A block inside a container becomes a placeholder while still holding placeholders.
  // replace does not rescan the text it inserted, so this runs until nothing moves.
  // The condition is "did anything change" rather than "are any markers left" because a
  // marker that cannot be resolved still has to stop the loop. An unknown number is left alone rather than deleted.
  while (true) {
    var prev = html;
    html = html.replace(MARK_RE, function (whole, a, b) {
      var blk = BLOCKS[Number(a != null ? a : b)];
      return blk == null ? whole : blk;
    });
    if (html === prev) break;
  }

  var docEl = $('#doc');
  docEl.innerHTML = html;
  // The source view carries SRC as it is. Export and copy use the same value, so the three cannot disagree.
  $('#rawSrc').textContent = SRC;

  $$('#doc .figure-bar .cap[data-gi]').forEach(function (el) {
    var g = GRAPHS[Number(el.dataset.gi)];
    // A key means the document called this diagram by name. Only then does the caption follow the list name.
    if (g && g.key) el.textContent = g.label;
  });

  $$('#doc table').forEach(function (t) {
    if (t.parentElement.classList.contains('table-scroll')) return;
    var w = document.createElement('div');
    w.className = 'table-scroll';
    t.parentNode.insertBefore(w, t);
    w.appendChild(t);
  });

  // ---------------------------------------------------------------- table widths
  // Markdown carries no widths, so the shell decides them. A table gets the width it wants
  // up to what the window has, which is wider than the text column and is why the text in it
  // stops wrapping. Over that the reader drags a column boundary; double click hands the
  // table back to the measurement.
  var COL_MIN = 56;

  function docPad() {
    var cs = getComputedStyle($('#doc'));
    return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  }

  // The width at which nothing in the table wraps. Reading it means laying the table out at
  // its intrinsic size for a moment, which is why the value is taken and the style dropped in
  // the same statement pair rather than left on.
  function wantedWidth(t) {
    if (t.classList.contains('sized')) return parseFloat(t.style.width);
    var prev = t.style.width;
    t.style.width = 'max-content';
    var nat = t.getBoundingClientRect().width;
    t.style.width = prev;
    return nat;
  }

  function fitTable(box) {
    var t = $('table', box);
    // Only a table that sits directly in the document may leave the column. Inside a callout
    // or a comparison the column is that block's, and reaching past it would break the block.
    // A hidden view measures zero, and a zero written here is a table with no width when the
    // view comes back, so measuring waits until the document is on screen.
    if (!t || box.parentElement !== $('#doc') || !box.offsetParent) return;
    var pad = docPad();
    var column = $('#doc').clientWidth - pad;
    var room = $('#main').clientWidth - pad;
    // The wrapper is a border box, so what the table gets is the width minus the wrapper's
    // own border. Leave it out and the table is two pixels short and wraps at every measure.
    var edge = box.offsetWidth - box.clientWidth;
    var want = Math.min(wantedWidth(t) + edge, room);
    // A table the reader has sized states its own width, so the frame follows it down as well
    // as up. One left to itself fills the column, and the frame stays out at the column with it.
    if (!t.classList.contains('sized')) want = Math.max(column, want);
    box.style.setProperty('--table-w', Math.round(want) + 'px');
  }

  function fitTables() { $$('#doc .table-scroll').forEach(fitTable); }

  // Turns the widths the browser chose into widths the table states, which is what makes one
  // column movable without the others resettling.
  function lockColumns(t) {
    if (t.classList.contains('sized')) return;
    var cells = $$('th, td', $('tr', t) || t);
    if (!cells.length) return;
    var group = document.createElement('colgroup'), total = 0;
    cells.forEach(function (c) {
      var w = Math.round(c.getBoundingClientRect().width);
      total += w;
      var col = document.createElement('col');
      col.style.width = w + 'px';
      group.appendChild(col);
    });
    t.insertBefore(group, t.firstChild);
    t.style.width = total + 'px';
    t.classList.add('sized');
  }

  function releaseColumns(t) {
    var group = $('colgroup', t);
    if (group) group.parentNode.removeChild(group);
    t.style.width = '';
    t.classList.remove('sized');
  }

  $$('#doc .table-scroll table').forEach(function (t) {
    var head = $('thead tr', t) || $('tr', t);
    if (!head) return;
    $$('th', head).forEach(function (th, i) {
      var g = document.createElement('span');
      g.className = 'col-grip';
      g.dataset.col = i;
      g.title = 'Drag to resize the column, double click to undo';
      th.appendChild(g);
    });
  });

  (function () {
    var drag = null;
    document.addEventListener('mousedown', function (e) {
      var g = e.target.closest && e.target.closest('.col-grip');
      if (!g || e.button) return;
      e.preventDefault();
      var box = g.closest('.table-scroll'), t = $('table', box);
      lockColumns(t);
      var col = t.querySelectorAll('col')[Number(g.dataset.col)];
      if (!col) return;
      drag = { box: box, t: t, col: col, grip: g, x: e.clientX, w: parseFloat(col.style.width), total: parseFloat(t.style.width) };
      g.classList.add('on');
      document.body.classList.add('cv-dragging');
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      // The other columns keep their widths and the table takes the difference, so pulling a
      // boundary moves that one boundary instead of reshuffling the whole row.
      var w = Math.max(COL_MIN, drag.w + (e.clientX - drag.x));
      drag.col.style.width = w + 'px';
      drag.t.style.width = (drag.total + (w - drag.w)) + 'px';
      fitTable(drag.box);
    });
    window.addEventListener('mouseup', function () {
      if (!drag) return;
      drag.grip.classList.remove('on');
      document.body.classList.remove('cv-dragging');
      drag = null;
    });
    document.addEventListener('dblclick', function (e) {
      var g = e.target.closest && e.target.closest('.col-grip');
      if (!g) return;
      var box = g.closest('.table-scroll');
      releaseColumns($('table', box));
      fitTable(box);
    });
  })();

  fitTables();
  window.addEventListener('resize', fitTables);

  // ---------------------------------------------------------------- contents and scrollspy
  var heads = $$('#doc h1, #doc h2, #doc h3, #doc h4');
  var toc = $('#toc'), seen = {};
  heads.forEach(function (h) {
    var base = slug(h.textContent), id = base;
    var n = 2; while (seen[id]) { id = base + '-' + n++; }
    seen[id] = 1; h.id = id;
    var a = document.createElement('a');
    a.href = '#' + id;
    a.className = 'lv' + h.tagName[1];
    a.textContent = h.textContent;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      // The contents point at a place in the document. Pressed from another view, go back to the document first.
      var wait = curView === 'doc' ? 0 : 30;
      setView('doc');
      setTimeout(function () { h.scrollIntoView({ behavior: wait ? 'auto' : 'smooth', block: 'start' }); }, wait);
      history.replaceState(null, '', '#' + id);
    });
    toc.appendChild(a);
  });

  var links = $$('#toc a');
  var main = $('#main');
  var HEADING_ID = {};
  heads.forEach(function (h) { HEADING_ID[h.textContent.trim()] = h.id; });

  function jumpToHeading(text) {
    var id = HEADING_ID[String(text || '').trim()];
    if (!id) return false;
    setView('doc');
    var el = document.getElementById(id);
    setTimeout(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.style.transition = 'background .2s';
      el.style.background = 'var(--accent-soft)';
      setTimeout(function () { el.style.background = ''; }, 1200);
    }, 30);
    return true;
  }
  // The contents are taller than the panel in any document of size, so the current entry has
  // to be brought along. It moves only when the current entry changes, which leaves a reader
  // scrolling the contents by hand alone until the body reaches a different section.
  function reveal(a) {
    if (!a) return;
    // The margin decides how far past the edge to go, not whether to go. Reading it as the
    // test would move the contents for an entry that is already on screen.
    var link = a.getBoundingClientRect(), panel = toc.getBoundingClientRect(), margin = 40, d = 0;
    if (link.top < panel.top) d = link.top - panel.top - margin;
    else if (link.bottom > panel.bottom) d = link.bottom - panel.bottom + margin;
    if (d) toc.scrollTo({ top: toc.scrollTop + d, behavior: 'smooth' });
  }

  var spied = -1;
  function spy() {
    var best = -1, bestTop = -1e9;
    heads.forEach(function (h, i) {
      var top = h.getBoundingClientRect().top - 90;
      if (top <= 0 && top > bestTop) { bestTop = top; best = i; }
    });
    if (best < 0) best = 0;
    if (best === spied) return;
    spied = best;
    links.forEach(function (a, i) { a.classList.toggle('on', i === best); });
    reveal(links[best]);
  }
  main.addEventListener('scroll', function () {
    if (spy._r) return;
    spy._r = requestAnimationFrame(function () { spy._r = 0; spy(); });
  });
  spy();

  // ---------------------------------------------------------------- mermaid
  // Colours are baked into the SVG. On a theme change everything is reinitialised with the
  // current tokens and redrawn. Otherwise a light page keeps nodes baked black in dark.
  var mermaidPass = 0;
  function paintMermaid() {
    if (!window.mermaid) return;
    var cs = getComputedStyle(document.documentElement);
    var v = function (n, f) { return (cs.getPropertyValue(n) || '').trim() || f; };
    var pass = ++mermaidPass;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      flowchart: { curve: 'linear', htmlLabels: true },
      fontFamily: v('--mono', 'monospace'),
      themeVariables: {
        background: v('--bg', '#f0eee9'),
        primaryColor: v('--bg-soft', '#f5f3ee'),
        primaryTextColor: v('--fg', '#1a1a18'),
        primaryBorderColor: v('--line-strong', '#c4c2bb'),
        secondaryColor: v('--bg-sunken', '#e8e5de'),
        tertiaryColor: v('--bg', '#f0eee9'),
        lineColor: v('--line-strong', '#c4c2bb'),
        textColor: v('--fg', '#1a1a18'),
        mainBkg: v('--bg-soft', '#f5f3ee'),
        nodeBorder: v('--line-strong', '#c4c2bb'),
        clusterBkg: 'transparent',
        clusterBorder: v('--line', '#d8d6d0'),
        edgeLabelBackground: v('--bg', '#f0eee9'),
        fontSize: '13px'
      }
    });
    $$('.figure[data-mermaid]').forEach(function (fig, idx) {
      var src = $('.mermaid-src', fig).textContent;
      var out = $('.mermaid-out', fig);
      mermaid.render('mermaid-svg-' + pass + '-' + idx, src).then(function (r) {
        if (pass !== mermaidPass) return;   // a late result from the previous theme is dropped
        out.innerHTML = r.svg;
        // If it was enlarged, lock the size again against the new svg
        if (fig.classList.contains('zoom')) { figLockSize(fig, true); figApply(fig); }
      }).catch(function (e) {
        if (pass !== mermaidPass) return;
        out.innerHTML = '<pre style="text-align:left"><code>' + esc(src) + '</code></pre>';
        console.warn('mermaid render failed', e);
      });
    });
  }
  onRepaint(paintMermaid);
  // mermaid is baked as ES modules and arrives one microtask later than this script, so the
  // first paint has to wait for it. A document with no diagram carries no mermaid and no
  // promise, and nothing here runs.
  if (!window.mermaid && window.__mermaidReady) {
    window.__mermaidReady.then(paintMermaid).catch(function (e) {
      console.warn('mermaid failed to load', e);
    });
  }

  // ---------------------------------------------------------------- figure zoom view
  // The svg mermaid emits carries width="100%" plus an inline max-width, so inside an
  // absolutely positioned container its measured size is 0. The truth about size is the viewBox.
  function svgSize(svg) {
    var vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { w: vb[2], h: vb[3] };
    var r = svg.getBoundingClientRect();
    return { w: r.width || 800, h: r.height || 500 };
  }

  function figView(fig) { if (!fig._v) fig._v = { s: 1, x: 0, y: 0 }; return fig._v; }

  function figLockSize(fig, on) {
    var svg = $('.mermaid-out svg', fig), out = $('.mermaid-out', fig);
    if (!svg) return;
    if (on) {
      if (svg.dataset.origStyle == null) svg.dataset.origStyle = svg.getAttribute('style') || '';
      var s = svgSize(svg);
      svg.style.maxWidth = 'none';
      svg.style.width = s.w + 'px';
      svg.style.height = s.h + 'px';
      out.style.width = s.w + 'px';
      out.style.height = s.h + 'px';
    } else {
      if (svg.dataset.origStyle != null) svg.setAttribute('style', svg.dataset.origStyle);
      out.style.width = ''; out.style.height = '';
    }
  }

  function figApply(fig) {
    var st = figView(fig), out = $('.mermaid-out', fig);
    if (!fig.classList.contains('zoom')) { out.style.transform = ''; return; }
    out.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px) scale(' + st.s + ')';
    var lab = $('.zlabel', fig);
    if (lab) lab.textContent = Math.round(st.s * 100) + '%';
  }

  function figFit(fig) {
    var st = figView(fig), body = $('.figure-body', fig), svg = $('.mermaid-out svg', fig);
    if (!svg) return;
    figLockSize(fig, true);
    var r = body.getBoundingClientRect(), s = svgSize(svg);
    var W = r.width || 800, H = r.height || 500;
    st.s = Math.min((W - 56) / s.w, (H - 56) / s.h, 3);
    if (!isFinite(st.s) || st.s <= 0) st.s = 1;
    st.x = (W - s.w * st.s) / 2;
    st.y = (H - s.h * st.s) / 2;
    figApply(fig);
  }
  function figZoom(fig, k) {
    var st = figView(fig), body = $('.figure-body', fig);
    var r = body.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2;
    var ns = Math.max(0.15, Math.min(6, st.s * k));
    st.x = cx - (cx - st.x) * (ns / st.s);
    st.y = cy - (cy - st.y) * (ns / st.s);
    st.s = ns;
    figApply(fig);
  }

  // Exported as a self contained SVG. Size, background and namespaces have to survive outside the page.
  function exportFigureSVG(fig) {
    var svg = $('.mermaid-out svg', fig);
    if (!svg) return toast('not rendered yet');
    var s = svgSize(svg);
    var clone = svg.cloneNode(true);
    clone.removeAttribute('style');
    clone.removeAttribute('data-orig-style');
    clone.removeAttribute('id');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('width', s.w);
    clone.setAttribute('height', s.h);
    clone.setAttribute('viewBox', '0 0 ' + s.w + ' ' + s.h);

    var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', 0); rect.setAttribute('y', 0);
    rect.setAttribute('width', s.w); rect.setAttribute('height', s.h);
    rect.setAttribute('fill', bg);
    clone.insertBefore(rect, clone.firstChild);

    var cap = $('.cap', fig);
    var name = slug((cap && cap.textContent.trim()) || 'diagram');
    var out = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
    download((META.slug || 'diagram') + '-' + name + '.svg', out, 'image/svg+xml');
  }

  docEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.figure-bar button');
    if (btn) {
      var fig = btn.closest('.figure'), act = btn.dataset.act;
      if (act === 'zoom') {
        var on = fig.classList.toggle('zoom');
        btn.innerHTML = on ? ICON.close : ICON.expand;
        btn.title = on ? 'Close' : 'Enlarge';
        if (on) setTimeout(function () { figFit(fig); }, 30);
        else { figLockSize(fig, false); figApply(fig); }
      } else if (act === 'zin') figZoom(fig, 1.25);
      else if (act === 'zout') figZoom(fig, 1 / 1.25);
      else if (act === 'zfit') figFit(fig);
      else if (act === 'src') {
        var showing = fig.classList.toggle('showsrc');
        btn.classList.toggle('on', showing);
        btn.title = showing ? 'Show the diagram' : 'Show the mermaid source';
      }
      else if (act === 'copysrc') {
        copyText($('.mermaid-src', fig).textContent).then(
          function () { toast('mermaid source copied'); },
          function () { toast('copy failed'); });
      }
      else if (act === 'svg') exportFigureSVG(fig);
      else if (act === 'canvas') { setView('canvas'); canvas.open(Number(btn.dataset.gi)); }
      return;
    }
  });

  docEl.addEventListener('wheel', function (e) {
    var fig = e.target.closest('.figure.zoom');
    if (!fig) return;
    e.preventDefault();
    var st = figView(fig), body = $('.figure-body', fig), r = body.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    var ns = Math.max(0.15, Math.min(6, st.s * Math.exp(-e.deltaY * 0.0015)));
    st.x = mx - (mx - st.x) * (ns / st.s);
    st.y = my - (my - st.y) * (ns / st.s);
    st.s = ns;
    figApply(fig);
  }, { passive: false });

  (function figPan() {
    var cur = null, sx = 0, sy = 0, ox = 0, oy = 0;
    docEl.addEventListener('mousedown', function (e) {
      var body = e.target.closest('.figure.zoom .figure-body');
      if (!body) return;
      cur = body.closest('.figure');
      var st = figView(cur);
      sx = e.clientX; sy = e.clientY; ox = st.x; oy = st.y;
      body.classList.add('panning');
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!cur) return;
      var st = figView(cur);
      st.x = ox + (e.clientX - sx);
      st.y = oy + (e.clientY - sy);
      figApply(cur);
    });
    window.addEventListener('mouseup', function () {
      if (!cur) return;
      var body = $('.figure-body', cur);
      if (body) body.classList.remove('panning');
      cur = null;
    });
  })();

  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var fig = $('.figure.zoom');
    if (!fig) return;
    fig.classList.remove('zoom');
    var b = $('[data-act=zoom]', fig);
    if (b) { b.innerHTML = ICON.expand; b.title = 'Enlarge'; }
    figLockSize(fig, false);
    figApply(fig);
  });

  // ---------------------------------------------------------------- view switch
  // The outgoing view fades out first, then the incoming one comes in.
  // The controls (tabs, left panel) change at once. A press does not wait for anything.
  var curView = null, viewToken = 0;
  function setView(v) {
    // The contents live in the source view too. They point at the same place in the same document, so pressing one goes back to the document.
    $('#toc').classList.toggle('on', v === 'doc' || v === 'raw');
    $('#graphList').classList.toggle('on', v === 'canvas');
    $('.nav-views').dataset.active = v;   // the active pill slides across
    $$('.nav-views button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); });

    var target = $(v === 'raw' ? '#rawView' : v === 'canvas' ? '#canvasView' : '#docView');
    var from = $('.view.on');

    function enter() {
      $$('.view').forEach(function (x) { x.classList.remove('on', 'leaving'); });
      target.classList.add('on');
      curView = v;
      if (v === 'canvas') canvas.ensure();
      // The window may have changed size while the document was off screen, where a table
      // cannot be measured.
      if (v === 'doc') fitTables();
    }

    if (curView === v) { if (v === 'canvas') canvas.ensure(); return; }
    if (!from || from === target) return enter();

    var token = ++viewToken;
    from.classList.add('leaving');
    setTimeout(function () { if (token === viewToken) enter(); }, 130);
  }
  $$('.nav-views button').forEach(function (b) {
    b.addEventListener('click', function () { setView(b.dataset.view); });
  });

  // ---------------------------------------------------------------- export and theme
  var fileBase = (META.slug || slug(META.title || 'analysis'));
  $('#btnMd').addEventListener('click', function () { download(fileBase + '.md', SRC, 'text/markdown'); });
  $('#btnCopy').addEventListener('click', function () {
    copyText(SRC).then(function () { toast('markdown copied'); },
      function () { toast('copy failed, use download instead'); });
  });
  $('#btnPrint').addEventListener('click', function () { window.print(); });

  // Collapsing the side panel. The collapsed state is remembered per document.
  var NAV_KEY = 'analysis-doc:' + (META.slug || 'doc') + ':nav-off';
  function setNav(off) {
    document.body.classList.toggle('nav-off', off);
    try { localStorage.setItem(NAV_KEY, off ? '1' : '0'); } catch (e) { }
    // A width change changes the viewport the canvas sees, so redraw once the animation ends
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 280);
  }
  var navBtn = $('#btnNav');
  var NAV_W_KEY = 'analysis-doc:' + (META.slug || 'doc') + ':nav-w';
  var NAV_MIN = 210, NAV_MAX = 560, NAV_SNAP = 150;   // dragged below SNAP it collapses

  function paintNav() {
    var off = document.body.classList.contains('nav-off');
    navBtn.title = off ? 'Expand, or drag to resize' : 'Collapse, or drag to resize';
    navBtn.setAttribute('aria-label', navBtn.title);
  }
  function navWidth() {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-w'));
    return isFinite(v) ? v : 300;
  }
  function setNavWidth(px) {
    px = Math.max(NAV_MIN, Math.min(NAV_MAX, px));
    document.documentElement.style.setProperty('--nav-w', px + 'px');
    try { localStorage.setItem(NAV_W_KEY, String(px)); } catch (e) { }
  }
  try {
    if (localStorage.getItem(NAV_KEY) === '1') document.body.classList.add('nav-off');
    var savedW = parseFloat(localStorage.getItem(NAV_W_KEY));
    if (isFinite(savedW)) setNavWidth(savedW);
  } catch (e) { }
  paintNav();

  // One handle does two things. Drag to resize, press to collapse or expand.
  (function () {
    var drag = null;
    navBtn.addEventListener('mousedown', function (e) {
      if (e.button) return;
      e.preventDefault();
      drag = { x: e.clientX, w: document.body.classList.contains('nav-off') ? 0 : navWidth(), moved: false };
      document.body.classList.add('nav-resizing', 'cv-dragging');
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 3) drag.moved = true;
      if (!drag.moved) return;
      var w = drag.w + dx;
      if (w < NAV_SNAP) {
        document.body.classList.add('nav-off');
      } else {
        document.body.classList.remove('nav-off');
        setNavWidth(w);
      }
      paintNav();
    });
    window.addEventListener('mouseup', function () {
      if (!drag) return;
      document.body.classList.remove('nav-resizing', 'cv-dragging');
      if (!drag.moved) setNav(!document.body.classList.contains('nav-off'));
      else setNav(document.body.classList.contains('nav-off'));
      drag = null;
      paintNav();
    });
    navBtn.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      setNav(!document.body.classList.contains('nav-off'));
      paintNav();
    });
  })();

  var THEMES = [
    { k: '', icon: ICON.auto, label: 'System' },
    { k: 'light', icon: ICON.sun, label: 'Light' },
    { k: 'dark', icon: ICON.moon, label: 'Dark' }
  ];
  // The theme is the reader's, not the document's, so the key carries no slug and one
  // choice holds across every document they open. The key is declared in the head, where
  // it is read early enough to set the theme before the shell paints.
  var THEME_KEY = window.THEME_KEY;
  var themeIdx = 0;
  var themeBtn = $('#btnTheme');
  function themeIndexOf(key) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].k === key) return i;
    return -1;
  }
  // The one place a theme reaches the screen, repainting the surfaces that bake colours in.
  // Pairing that up at each call site instead means one missed spot keeps its old theme.
  function paintTheme() {
    var t = THEMES[themeIdx];
    if (t.k) document.documentElement.setAttribute('data-theme', t.k);
    else document.documentElement.removeAttribute('data-theme');
    themeBtn.dataset.state = t.k || 'auto';
    $('.theme-icon', themeBtn).innerHTML = t.icon;
    $('.theme-label', themeBtn).textContent = t.label;
    themeBtn.title = 'Theme: ' + t.label + ' (click to switch)';
    REPAINT.forEach(function (f) { f(); });
  }
  themeBtn.addEventListener('click', function () {
    themeIdx = (themeIdx + 1) % THEMES.length;
    // Only a press writes. The system listener repaints without moving the choice, and
    // writing there would turn following the system into a stored light or dark.
    try { localStorage.setItem(THEME_KEY, THEMES[themeIdx].k); } catch (e) { }
    paintTheme();
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSys = function () { if (!THEMES[themeIdx].k) paintTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onSys);
    else if (mq.addListener) mq.addListener(onSys);
  }
  try {
    var savedTheme = themeIndexOf(localStorage.getItem(THEME_KEY));
    if (savedTheme >= 0) themeIdx = savedTheme;
  } catch (e) { }
  paintTheme();

  // ---------------------------------------------------------------- own dropdown
  function ddFace(o) {
    return (o.prev ? '<span class="dd-prev">' + o.prev + '</span>' : '') +
      '<span class="dd-cur">' + esc(o.t) + '</span>';
  }
  function makeDropdown(options, value, onPick) {
    var el = document.createElement('div');
    el.className = 'dd';
    var cur = options.filter(function (o) { return o.v === value; })[0] || options[0];
    el.innerHTML =
      '<button type="button" class="dd-btn">' + ddFace(cur) + ICON.caret + '</button>' +
      '<div class="dd-menu">' + options.map(function (o) {
        return '<div class="dd-opt' + (o.v === value ? ' on' : '') + '" data-v="' + esc(o.v) + '">' +
          (o.prev ? '<span class="dd-prev">' + o.prev + '</span>' : '') + esc(o.t) + '</div>';
      }).join('') + '</div>';

    $('.dd-btn', el).addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = el.classList.contains('open');
      $$('.dd.open').forEach(function (d) { d.classList.remove('open'); });
      el.classList.toggle('open', !wasOpen);
    });
    $('.dd-menu', el).addEventListener('click', function (e) {
      var o = e.target.closest('.dd-opt');
      if (!o) return;
      e.stopPropagation();
      el.classList.remove('open');
      var picked = options.filter(function (x) { return x.v === o.dataset.v; })[0];
      $$('.dd-opt', el).forEach(function (x) { x.classList.toggle('on', x === o); });
      $('.dd-btn', el).innerHTML = ddFace(picked) + ICON.caret;
      onPick(picked.v);
    });
    return el;
  }
  document.addEventListener('click', function () {
    $$('.dd.open').forEach(function (d) { d.classList.remove('open'); });
  });

  function makeSwatches(colors, value, onPick) {
    var box = document.createElement('div');
    var wrap = document.createElement('div');
    wrap.className = 'sw-grid';
    box.appendChild(wrap);

    var hex = document.createElement('input');
    hex.className = 'sw-hex';
    hex.type = 'text';
    hex.placeholder = '#RRGGBB, or empty for the default';
    hex.value = value || '';

    function mark(c) {
      c = c || '';
      var known = colors.some(function (x) { return (x || '') === c; });
      $$('.sw', wrap).forEach(function (x) {
        x.classList.toggle('on', x.classList.contains('custom')
          ? (!known && !!c)
          : (x.dataset.color || '') === c);
      });
      if (hex.value !== c) hex.value = c;
      onPick(c);
    }

    colors.forEach(function (c) {
      var s = document.createElement('span');
      s.className = 'sw' + (c ? '' : ' auto') + ((c || '') === (value || '') ? ' on' : '');
      s.dataset.color = c;
      s.title = c || 'default';
      if (c) s.style.background = c;
      s.addEventListener('click', function () { mark(c); });
      wrap.appendChild(s);
    });

    // Custom. The system colour picker plus direct entry.
    var isKnown = colors.some(function (x) { return (x || '') === (value || ''); });
    var custom = document.createElement('label');
    custom.className = 'sw custom' + (!isKnown && value ? ' on' : '');
    custom.title = 'Pick a colour';
    var picker = document.createElement('input');
    picker.type = 'color';
    picker.value = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#4a9eff';
    picker.addEventListener('input', function () { mark(picker.value); });
    custom.appendChild(picker);
    wrap.appendChild(custom);

    hex.addEventListener('input', function () {
      var t = hex.value.trim();
      if (!t) return mark('');
      if (/^#?[0-9a-f]{3}$|^#?[0-9a-f]{6}$/i.test(t)) mark(t[0] === '#' ? t : '#' + t);
    });
    box.appendChild(hex);
    return box;
  }

  // ---------------------------------------------------------------- flow canvas
  var PALETTE = ['', '#4a9eff', '#52c97a', '#e6b84a', '#e05a5a', '#a78bfa', '#4dd0c7', '#8a8a80', '#1a1a18', '#f0eee9'];

  // Shapes drawn as SVG. viewBox 0 0 100 100, stretched to the node size.
  var SHAPE_SVG = {
    diamond: '<polygon points="50,1 99,50 50,99 1,50"/>',
    hexagon: '<polygon points="16,1 84,1 99,50 84,99 16,99 1,50"/>',
    parallelogram: '<polygon points="18,1 99,1 82,99 1,99"/>',
    trapezoid: '<polygon points="18,1 82,1 99,99 1,99"/>',
    cylinder: '<path d="M1,13 A49,12 0 0 1 99,13 L99,87 A49,12 0 0 1 1,87 Z"/><path d="M1,13 A49,12 0 0 0 99,13"/>',
    doublecircle: '<circle cx="50" cy="50" r="49"/><circle cx="50" cy="50" r="42"/>'
  };

  function shapePrev(kind) {
    var inner = {
      rect: '<rect x="1" y="1" width="24" height="13"/>',
      round: '<rect x="1" y="1" width="24" height="13" rx="4"/>',
      stadium: '<rect x="1" y="1" width="24" height="13" rx="6.5"/>',
      circle: '<circle cx="13" cy="7.5" r="6.5"/>',
      doublecircle: '<circle cx="13" cy="7.5" r="6.5"/><circle cx="13" cy="7.5" r="4"/>',
      subroutine: '<rect x="1" y="1" width="24" height="13"/><path d="M5 1v13M21 1v13"/>',
      diamond: '<polygon points="13,1 25,7.5 13,14 1,7.5"/>',
      hexagon: '<polygon points="5,1 21,1 25,7.5 21,14 5,14 1,7.5"/>',
      parallelogram: '<polygon points="5,1 25,1 21,14 1,14"/>',
      trapezoid: '<polygon points="5,1 21,1 25,14 1,14"/>',
      cylinder: '<path d="M2,4 A11,3 0 0 1 24,4 L24,11 A11,3 0 0 1 2,11 Z"/>'
    }[kind] || '';
    return '<svg viewBox="0 0 26 15">' + inner + '</svg>';
  }
  function linePrev(style) {
    if (style === 'none') return '<svg viewBox="0 0 26 15"></svg>';
    var dash = { dashed: '5 3', dotted: '1.5 3' }[style] || '';
    return '<svg viewBox="0 0 26 15"><path d="M1 7.5h24"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/></svg>';
  }
  function arrowPrev(kind) {
    var head = {
      none: '',
      triangle: '<polygon class="fillx" points="17,3 25,7.5 17,12"/>',
      open: '<path d="M18,3 L25,7.5 L18,12"/>',
      circle: '<circle class="fillx" cx="22" cy="7.5" r="3.4"/>',
      diamond: '<polygon class="fillx" points="17,7.5 21,4 25,7.5 21,11"/>',
      tee: '<path d="M23,2.5v10"/>'
    }[kind] || '';
    return '<svg viewBox="0 0 26 15"><path d="M1 7.5h16"/>' + head + '</svg>';
  }

  var SHAPES = [
    { v: 'rect', t: 'Rectangle', prev: shapePrev('rect') },
    { v: 'round', t: 'Rounded', prev: shapePrev('round') },
    { v: 'stadium', t: 'Stadium', prev: shapePrev('stadium') },
    { v: 'circle', t: 'Circle', prev: shapePrev('circle') },
    { v: 'doublecircle', t: 'Double circle', prev: shapePrev('doublecircle') },
    { v: 'subroutine', t: 'Subroutine', prev: shapePrev('subroutine') },
    { v: 'diamond', t: 'Diamond (branch)', prev: shapePrev('diamond') },
    { v: 'hexagon', t: 'Hexagon (prepare)', prev: shapePrev('hexagon') },
    { v: 'parallelogram', t: 'Parallelogram (I/O)', prev: shapePrev('parallelogram') },
    { v: 'trapezoid', t: 'Trapezoid (manual)', prev: shapePrev('trapezoid') },
    { v: 'cylinder', t: 'Cylinder (storage)', prev: shapePrev('cylinder') }
  ];
  var LINE_STYLES = [
    { v: 'solid', t: 'Solid', prev: linePrev('solid') },
    { v: 'dashed', t: 'Dashed', prev: linePrev('dashed') },
    { v: 'dotted', t: 'Dotted', prev: linePrev('dotted') },
    { v: 'none', t: 'None', prev: linePrev('none') }
  ];
  var WIDTHS = [{ v: '1', t: '1px' }, { v: '1.5', t: '1.5px' }, { v: '2', t: '2px' }, { v: '3', t: '3px' }];
  var ARROWS = [
    { v: 'triangle', t: 'Triangle', prev: arrowPrev('triangle') },
    { v: 'open', t: 'Open', prev: arrowPrev('open') },
    { v: 'diamond', t: 'Diamond', prev: arrowPrev('diamond') },
    { v: 'circle', t: 'Circle', prev: arrowPrev('circle') },
    { v: 'tee', t: 'Bar', prev: arrowPrev('tee') },
    { v: 'none', t: 'None', prev: arrowPrev('none') }
  ];
  var ROUTES = [
    { v: 'auto', t: 'Auto' },
    { v: 'curve', t: 'Curved' },
    { v: 'step', t: 'Orthogonal' }
  ];

  // SSoT is the markdown. The canvas is a view, and all it stores is a presentation overlay.
  //   Structure (nodes, edges, labels) is reparsed from the document on every open.
  //   overlay = graph key -> { view, nodes:{id:{x,y,shape,colour...}}, edges:{key:{colour,line,arrow,path}} }
  // Whether it can store is tried rather than asked. A browser that blocks storage still
  // has `localStorage` and throws on write (a file:// document, a private window). Leaving
  // editing open without it loses a moved layout on the next open, so it is measured once here and the canvas locks.
  var CAN_STORE = (function () {
    try {
      var k = 'analysis-doc:probe';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  var STORE_KEY = 'analysis-doc:' + (META.slug || 'doc') + ':overlay';
  var MAP_KEY = 'analysis-doc:' + (META.slug || 'doc') + ':map-folded';
  var SNAP_KEY = 'analysis-doc:' + (META.slug || 'doc') + ':snap';
  var ROW_H = 116, COL_W = 275, ARROW_GAP = 7;   // a cell's worth of distance, for routing
  var COL_GAP = 74, ROW_GAP = 46;               // what stands between measured nodes
  var BAND_GAP = 70, MIN_WRAP_COLS = 10;

  var canvas = (function () {
    var stage, world, edgesSvg, inspect, listEl;
    var overlay = {};
    var g = null;            // the parsed diagram in hand, straight from the document
    var view = { tx: 40, ty: 40, scale: 1 };
    var cur = -1, sel = null, focusOn = false, booted = false;
    var mapFolded = false;

    function loadOverlay() {
      try {
        var s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (s && typeof s === 'object') overlay = s;
      } catch (e) { overlay = {}; }
    }
    function saveOverlay() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(overlay)); } catch (e) { }
    }
    // Editing needs both: storage that can be written, and an address to write to.
    // Missing either, a change is gone on the next open or lands on someone else's diagram.
    function editable() {
      return CAN_STORE && !!(GRAPHS[cur] && GRAPHS[cur].key);
    }
    function lockReason() {
      if (!CAN_STORE) return 'This browser cannot store the layout, so editing is locked. Anything moved would be gone on reopening. Use Save to keep a layout.';
      var why = GRAPHS[cur] && GRAPHS[cur].lock;
      if (why === 'dup') return 'A diagram earlier in the document has the same name, so this layout cannot be kept apart from it. Give this one a different name after the fence.';
      return 'A diagram with no name has nowhere to keep a layout. Give it a name after the fence and editing opens: ```mermaid name';
    }

    function slot() {
      var k = GRAPHS[cur].key;
      // A diagram with no address gets no slot in storage. An empty slot is enough for the
      // reader, and making one here would have every unnamed diagram share a single ''.
      if (!k) return { nodes: {}, edges: {} };
      if (!overlay[k]) overlay[k] = { nodes: {}, edges: {} };
      if (!overlay[k].nodes) overlay[k].nodes = {};
      if (!overlay[k].edges) overlay[k].edges = {};
      return overlay[k];
    }
    function nodeOv(id) { var s = slot(); return (s.nodes[id] = s.nodes[id] || {}); }
    function edgeOv(k) { var s = slot(); return (s.edges[k] = s.edges[k] || {}); }
    function edgeKey(e) { return e.from + '\u2192' + e.to + '#' + e.ord; }

    // How far along the flow each key sits. Back edges are left out. A cycle in the document,
    // a failure looping back into the entry for instance, makes longest path relaxation push
    // levels out without end and the canvas blows up. The edges are still drawn. Only the
    // levels come from the acyclic subgraph.
    function levels(keys, links) {
      var out = {};
      links.forEach(function (e) { (out[e.from] = out[e.from] || []).push(e); });
      var mark = {}, isBack = {};
      keys.forEach(function (k) {
        if (mark[k]) return;
        var stack = [{ id: k, i: 0 }];
        mark[k] = 1;
        while (stack.length) {
          var top = stack[stack.length - 1];
          var es = out[top.id] || [];
          if (top.i >= es.length) { mark[top.id] = 2; stack.pop(); continue; }
          var e = es[top.i++];
          if (mark[e.to] === 1) { isBack[e.from + '\u2192' + e.to] = 1; continue; }
          if (!mark[e.to]) { mark[e.to] = 1; stack.push({ id: e.to, i: 0 }); }
        }
      });
      var acyclic = links.filter(function (e) { return !isBack[e.from + '\u2192' + e.to]; });

      var level = {}, indeg = {};
      keys.forEach(function (k) { indeg[k] = 0; });
      acyclic.forEach(function (e) { indeg[e.to]++; });
      var queue = keys.filter(function (k) { return !indeg[k]; });
      if (!queue.length && keys.length) queue = [keys[0]];
      queue.forEach(function (k) { level[k] = 0; });
      var guard = 0;
      while (queue.length && guard++ < 20000) {
        var c = queue.shift();
        acyclic.forEach(function (e) {
          if (e.from !== c) return;
          var d = (level[c] || 0) + 1;
          if (d >= keys.length) return;
          if (level[e.to] == null || level[e.to] < d) { level[e.to] = d; queue.push(e.to); }
        });
      }
      keys.forEach(function (k) { if (level[k] == null) level[k] = 0; });
      return level;
    }

    // ---- layout (for nodes the overlay has no position for)
    function layout(nodes, edges) {
      var ids = {}; nodes.forEach(function (n) { ids[n.id] = n; });
      var inner = edges.filter(function (e) { return ids[e.from] && ids[e.to]; });

      // A subgraph is laid out as one thing. The levels are taken on the graph with each
      // group folded into a single unit, so a group holds a run of columns instead of being
      // torn apart wherever the flow leaves it and comes back. Inside the run the members are
      // levelled again among themselves. A document with no subgraph folds nothing, and the
      // fold of a plain graph is the graph, so it lands exactly where it did before.
      function unit(id) { return (ids[id].group ? 'g ' + ids[id].group : 'n ' + id); }
      var units = [], seenUnit = {};
      nodes.forEach(function (n) {
        var u = unit(n.id);
        if (!seenUnit[u]) { seenUnit[u] = 1; units.push(u); }
      });
      var folded = [];
      inner.forEach(function (e) {
        var a = unit(e.from), b = unit(e.to);
        if (a !== b) folded.push({ from: a, to: b });
      });
      var uLevel = levels(units, folded);

      // Depth inside a group, from the edges the group holds on its own.
      var members = {}, depth = {}, span = {};
      nodes.forEach(function (n) { if (n.group) (members[n.group] = members[n.group] || []).push(n.id); });
      Object.keys(members).forEach(function (g) {
        var mine = {};
        members[g].forEach(function (id) { mine[id] = 1; });
        var sub = levels(members[g], inner.filter(function (e) { return mine[e.from] && mine[e.to]; }));
        var wide = 0;
        members[g].forEach(function (id) { depth[id] = sub[id]; wide = Math.max(wide, sub[id] + 1); });
        span[g] = wide;
      });

      // A level of the folded graph is as wide as the widest unit standing on it, and the
      // next level starts past it.
      var uMax = 0;
      units.forEach(function (u) { uMax = Math.max(uMax, uLevel[u]); });
      var width = [], start = [], at = 0;
      for (var ui = 0; ui <= uMax; ui++) width.push(1);
      units.forEach(function (u) {
        var w = u.charAt(0) === 'g' ? span[u.slice(2)] : 1;
        if (w > width[uLevel[u]]) width[uLevel[u]] = w;
      });
      for (var uj = 0; uj <= uMax; uj++) { start.push(at); at += width[uj]; }

      var layer = {};
      nodes.forEach(function (n) {
        layer[n.id] = start[uLevel[unit(n.id)]] + (n.group ? depth[n.id] : 0);
      });

      var maxL = 0;
      nodes.forEach(function (n) { maxL = Math.max(maxL, layer[n.id]); });
      var layers = [];
      for (var i = 0; i <= maxL; i++) layers.push([]);
      nodes.forEach(function (n) { layers[layer[n.id]].push(n.id); });

      var pos = {};
      layers.forEach(function (L) { L.forEach(function (id, i) { pos[id] = i; }); });
      for (var pass = 0; pass < 4; pass++) {
        var forward = pass % 2 === 0;
        var order = [];
        for (var k = 0; k <= maxL; k++) order.push(forward ? k : maxL - k);
        order.forEach(function (li) {
          var L = layers[li];
          if (!L.length) return;
          var bary = {};
          L.forEach(function (id) {
            var refs = inner.filter(function (e) {
              return forward ? (e.to === id && layer[e.from] === li - 1)
                             : (e.from === id && layer[e.to] === li + 1);
            }).map(function (e) { return pos[forward ? e.from : e.to]; });
            bary[id] = refs.length ? refs.reduce(function (a, b) { return a + b; }, 0) / refs.length : pos[id];
          });
          // Members of a group stay next to each other in the column. The group rides on the
          // mean of its members and they keep their own order inside it. Without the name as
          // a tiebreak, two groups landing on the same mean comb into each other.
          var sum = {}, count = {};
          L.forEach(function (id) {
            var g = ids[id].group;
            if (!g) return;
            sum[g] = (sum[g] || 0) + bary[id];
            count[g] = (count[g] || 0) + 1;
          });
          var rank = function (id) {
            var g = ids[id].group;
            return g ? sum[g] / count[g] : bary[id];
          };
          L.sort(function (a, b) {
            var ga = ids[a].group || '', gb = ids[b].group || '';
            return rank(a) - rank(b) || (ga < gb ? -1 : ga > gb ? 1 : 0) ||
              bary[a] - bary[b] || pos[a] - pos[b];
          });
          L.forEach(function (id, i) { pos[id] = i; });
        });
      }

      var rows = 0;
      layers.forEach(function (L) { rows = Math.max(rows, L.length); });

      // Which row each node takes. A group runs across several columns, so it only reads as
      // one block if it holds the same rows in all of them. A group takes the rows it first
      // lands on and keeps them; a column that has to push it down carries it down from there.
      var grouped = nodes.some(function (n) { return !!n.group; });
      var row = {}, lane = {};
      layers.forEach(function (L) {
        var r = 0, i = 0;
        while (i < L.length) {
          var g = ids[L[i]].group;
          if (!g) { row[L[i]] = r++; i++; continue; }
          var run = 1;
          while (i + run < L.length && ids[L[i + run]].group === g) run++;
          var top = lane[g] == null ? r : Math.max(r, lane[g]);
          lane[g] = top;
          for (var k = 0; k < run; k++) row[L[i + k]] = top + k;
          r = top + run;
          i += run;
        }
      });
      if (grouped) {
        var deepest = 0;
        layers.forEach(function (L) { L.forEach(function (id) { deepest = Math.max(deepest, row[id]); }); });
        rows = deepest + 1;
      }

      // Which row each node stands on. Taking the position in the column, as it used to, puts
      // a chain one row lower at every step: the second node of a two node column is row 1
      // whether or not anything stands above it. A node takes the row of the median of what
      // feeds it instead, and the column is then spread just enough to keep the order the
      // crossing passes settled on. A chain of one parent to one child comes out straight.
      var slot = {};
      layers.forEach(function (L) { L.forEach(function (id, i) { slot[id] = i; }); });
      if (!grouped) {
        for (var mp = 0; mp < 4; mp++) {
          var back = mp % 2 === 1;
          var seq = [];
          for (var sk = 0; sk <= maxL; sk++) seq.push(back ? maxL - sk : sk);
          seq.forEach(function (li) {
            var L = layers[li];
            if (!L.length) return;
            var want = L.map(function (id) {
              var refs = inner.filter(function (e) {
                return back ? (e.from === id && layer[e.to] === li + 1)
                            : (e.to === id && layer[e.from] === li - 1);
              }).map(function (e) { return slot[back ? e.to : e.from]; });
              if (!refs.length) return slot[id];
              refs.sort(function (a, b) { return a - b; });
              var m = refs.length >> 1;
              return refs.length % 2 ? refs[m] : (refs[m - 1] + refs[m]) / 2;
            });
            var floor = -Infinity;
            L.forEach(function (id, i) {
              floor = Math.max(want[i], floor + 1);
              slot[id] = floor;
            });
          });
        }
        var low = Infinity, high = -Infinity;
        nodes.forEach(function (n) { low = Math.min(low, slot[n.id]); high = Math.max(high, slot[n.id]); });
        nodes.forEach(function (n) { slot[n.id] -= low; });
        rows = high - low + 1;
      }
      function rowOf(id) { return grouped ? row[id] : slot[id]; }

      // The cell is the measured content rather than the largest a node is allowed to be. A
      // column of short labels no longer sits in the gap left for a long one.
      var slotH = 0, wideW = 0;
      nodes.forEach(function (n) { slotH = Math.max(slotH, n.h); wideW = Math.max(wideW, n.w); });
      slotH += ROW_GAP;

      // A long thin stack of levels is folded like a snake. A 45 step pipeline laid out in one
      // row is an 8000px band with nothing readable in it. The band width is picked to land closest to the screen ratio (about 1.6).
      var total = maxL + 1, bandCols = total, bandH = rows * slotH + BAND_GAP;
      if (total > MIN_WRAP_COLS) {
        var best = Infinity;
        for (var c = 4; c <= total; c++) {
          var w = c * (wideW + COL_GAP), h = Math.ceil(total / c) * bandH;
          var score = Math.abs(w / h - 1.6);
          if (score < best) { best = score; bandCols = c; }
        }
      }

      function colOf(li) {
        var band = Math.floor(li / bandCols);
        // Odd bands run in reverse so the flow carries straight down where one band meets the next.
        return band % 2 ? bandCols - 1 - (li % bandCols) : li % bandCols;
      }

      // Every band puts its first column at the same x, so the width of a column is the widest
      // node standing in it in any band.
      var colW = [], colX = [], run = 0;
      for (var ci = 0; ci < bandCols; ci++) colW.push(0);
      layers.forEach(function (L, li) {
        L.forEach(function (id) { colW[colOf(li)] = Math.max(colW[colOf(li)], ids[id].w); });
      });
      for (ci = 0; ci < bandCols; ci++) { colX.push(run); run += colW[ci] + COL_GAP; }

      layers.forEach(function (L, li) {
        var band = Math.floor(li / bandCols), col = colOf(li);
        // The rows are read across the whole graph rather than within one column, so a column
        // is not centred on its own length. Centring it would undo the alignment above.
        L.forEach(function (id) {
          var n = ids[id];
          n.ax = 60 + colX[col] + (colW[col] - n.w) / 2;
          n.ay = 60 + band * bandH + rowOf(id) * slotH + (slotH - ROW_GAP - n.h) / 2;
        });
      });
    }

    // ---- build the graph from the document, then lay the overlay on top
    function build(i) {
      var blk = GRAPHS[i];
      var parsed = parseGraph(blk.src);
      var ord = {};
      var edges = parsed.edges.map(function (e) {
        var base = e.from + '\u2192' + e.to;
        var o = (ord[base] = (ord[base] || 0) + 1) - 1;
        return {
          from: e.from, to: e.to, ord: o,
          label: e.label,                       // owned by the document
          style: e.style || 'solid', width: e.width || '1',
          arrow: 'triangle', route: 'auto', color: ''
        };
      });
      var nodes = parsed.nodes.map(function (n) {
        return { id: n.id, label: n.label, shape: n.shape, group: n.group };
      });

      measure(nodes);
      layout(nodes, edges);

      cur = i;
      var s = slot();
      // Overlay entries for ids the document no longer has are dropped, so no ghosts stay
      var live = {}; nodes.forEach(function (n) { live[n.id] = 1; });
      var liveE = {}; edges.forEach(function (e) { liveE[edgeKey(e)] = 1; });
      var pruned = 0;
      Object.keys(s.nodes).forEach(function (id) { if (!live[id]) { delete s.nodes[id]; pruned++; } });
      Object.keys(s.edges).forEach(function (k) { if (!liveE[k]) { delete s.edges[k]; pruned++; } });
      if (pruned) saveOverlay();   // the cleanup is kept too, or the ghosts pile up in storage

      nodes.forEach(function (n) {
        var o = s.nodes[n.id] || {};
        n.x = o.x != null ? o.x : n.ax;
        n.y = o.y != null ? o.y : n.ay;
        n.shape = o.shape || n.shape;
        n.bg = o.bg || ''; n.fg = o.fg || ''; n.border = o.border || '';
        n.borderStyle = o.borderStyle || 'solid';
        n.borderWidth = o.borderWidth || '1';
      });
      edges.forEach(function (e) {
        var o = s.edges[edgeKey(e)] || {};
        if (o.color) e.color = o.color;
        if (o.style) e.style = o.style;
        if (o.width) e.width = o.width;
        if (o.arrow) e.arrow = o.arrow;
        if (o.route) e.route = o.route;
      });

      g = { nodes: nodes, edges: edges };
      view = (s.view && s.view.scale) ? { tx: s.view.tx, ty: s.view.ty, scale: s.view.scale } : { tx: 40, ty: 40, scale: 1 };
      sel = null;
    }

    function nodeById(id) { for (var i = 0; i < g.nodes.length; i++) if (g.nodes[i].id === id) return g.nodes[i]; return null; }
    function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }
    function nodeEl(id) { return $('.cv-node[data-id="' + cssEsc(id) + '"]', world); }
    // A node selection carries every picked node. The inspector still wants one, because
    // what it edits is one node's properties, so it answers only when one is picked.
    function selIds() { return sel && sel.t === 'node' ? sel.ids : []; }
    function selGroup() { return sel && sel.t === 'group' ? sel.name : null; }
    function groupIds(name) {
      return g.nodes.filter(function (n) { return n.group === name; }).map(function (n) { return n.id; });
    }
    function isSel(id) { return selIds().indexOf(id) >= 0; }
    function selNode() { return selIds().length === 1 ? nodeById(sel.ids[0]) : null; }
    function selEdge() { return sel && sel.t === 'edge' ? g.edges[sel.i] : null; }

    function applyNodeStyle(el, n) {
      if (SHAPE_SVG[n.shape]) {
        var sh = $('.cv-shape', el);
        if (sh) {
          $$('polygon, path, circle', sh).forEach(function (s) {
            s.style.fill = n.bg || '';
            s.style.stroke = n.border || '';
            s.style.strokeWidth = (n.borderWidth || 1);
            s.style.strokeDasharray = { dashed: '6 4', dotted: '1.5 3' }[n.borderStyle] || '';
            s.style.strokeOpacity = n.borderStyle === 'none' ? '0' : '';
          });
        }
        el.style.color = n.fg || '';
      } else {
        el.style.background = n.bg || '';
        el.style.color = n.fg || '';
        el.style.borderColor = n.border || '';
        el.style.borderStyle = n.borderStyle || 'solid';
        el.style.borderWidth = (n.borderWidth || 1) + 'px';
      }
    }

    function focusSet() {
      if (!focusOn || !sel) return null;
      var keep = {};
      if (sel.t === 'group') {
        groupIds(sel.name).forEach(function (id) {
          keep[id] = 1;
          g.edges.forEach(function (e) {
            if (e.from === id) keep[e.to] = 1;
            if (e.to === id) keep[e.from] = 1;
          });
        });
      } else if (sel.t === 'node') {
        sel.ids.forEach(function (id) {
          keep[id] = 1;
          g.edges.forEach(function (e) {
            if (e.from === id) keep[e.to] = 1;
            if (e.to === id) keep[e.from] = 1;
          });
        });
      } else {
        var e = g.edges[sel.i];
        if (e) { keep[e.from] = 1; keep[e.to] = 1; }
      }
      return keep;
    }

    // The frame around a subgraph is the bounds of its members and nothing else. It has no
    // position of its own, so there is none to store and none to fall out of step with the
    // document: drag a member out and the frame follows it out.
    var FRAME_PAD = 16, FRAME_HEAD = 27;   // room for the tab that names the group
    function drawFrames() {
      $$('.cv-frame', world).forEach(function (el) { el.remove(); });
      var bounds = {};
      g.nodes.forEach(function (n) {
        if (!n.group) return;
        var el = nodeEl(n.id);
        if (!el || !el.offsetWidth) return;
        var b = bounds[n.group] || (bounds[n.group] = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
        b.x1 = Math.min(b.x1, n.x);
        b.y1 = Math.min(b.y1, n.y);
        b.x2 = Math.max(b.x2, n.x + el.offsetWidth);
        b.y2 = Math.max(b.y2, n.y + el.offsetHeight);
      });
      Object.keys(bounds).forEach(function (name) {
        var b = bounds[name];
        var el = document.createElement('div');
        el.className = 'cv-frame' + (selGroup() === name ? ' on' : '');
        el.dataset.group = name;
        el.style.left = (b.x1 - FRAME_PAD) + 'px';
        el.style.top = (b.y1 - FRAME_PAD - FRAME_HEAD) + 'px';
        el.style.width = (b.x2 - b.x1 + FRAME_PAD * 2) + 'px';
        el.style.height = (b.y2 - b.y1 + FRAME_PAD * 2 + FRAME_HEAD) + 'px';
        el.innerHTML = '<span class="cv-frame-name">' + ICON.grip + esc(name) + '</span>';
        // Behind the edges and the nodes, which is what the order in the world decides.
        world.insertBefore(el, world.firstChild);
      });
    }

    function nodeMarkup(n, extra) {
      var el = document.createElement('div');
      var shaped = !!SHAPE_SVG[n.shape];
      el.className = 'cv-node ' + (n.shape || 'rect') + (shaped ? ' shaped' : '') + (extra || '');
      el.dataset.id = n.id;
      el.innerHTML =
        (shaped ? '<svg class="cv-shape" viewBox="0 0 100 100" preserveAspectRatio="none">' + SHAPE_SVG[n.shape] + '</svg>' : '') +
        '<div class="cv-label">' + esc(n.label) + '</div>';
      applyNodeStyle(el, n);
      return el;
    }

    // What a node comes out as on screen, read before the layout runs. The size depends on
    // the label, the shape and the border the reader chose, so the only honest source is a
    // real one laid out by the browser.
    function measure(nodes) {
      var pad = document.createElement('div');
      pad.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
      world.appendChild(pad);
      nodes.forEach(function (n) {
        var el = nodeMarkup(n);
        pad.appendChild(el);
        n.w = el.offsetWidth;
        n.h = el.offsetHeight;
      });
      pad.remove();
      // Measured while the canvas is off screen, everything comes back zero. The old fixed
      // cell stands in, so a layout still comes out and is redone when the view opens.
      var blind = nodes.some(function (n) { return !n.w; });
      nodes.forEach(function (n) { if (!n.w) { n.w = 190; n.h = 44; } });
      return !blind;
    }

    function draw() {
      world.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.scale + ')';
      $('#cvZoomLabel').textContent = Math.round(view.scale * 100) + '%';
      $$('.cv-node', world).forEach(function (el) { el.remove(); });
      var keep = focusSet();
      g.nodes.forEach(function (n) {
        var el = nodeMarkup(n, (isSel(n.id) ? ' sel' : '') + (keep && !keep[n.id] ? ' dim' : ''));
        el.style.left = n.x + 'px';
        el.style.top = n.y + 'px';
        world.appendChild(el);
      });
      drawFrames();
      requestAnimationFrame(function () { drawEdges(); drawMap(); });
    }

    // Zero length segments are removed. Left in, an arrowhead at the end of the path loses its direction.
    function dedupe(pts) {
      var out = [pts[0]];
      for (var i = 1; i < pts.length; i++) {
        var p = pts[i], q = out[out.length - 1];
        if (Math.abs(p[0] - q[0]) > 0.5 || Math.abs(p[1] - q[1]) > 0.5) out.push(p);
      }
      return out.length > 1 ? out : [pts[0], pts[pts.length - 1]];
    }

    function roundedPath(pts, r) {
      var d = 'M' + pts[0][0] + ',' + pts[0][1];
      for (var i = 1; i < pts.length - 1; i++) {
        var p = pts[i], prev = pts[i - 1], next = pts[i + 1];
        var v1 = [p[0] - prev[0], p[1] - prev[1]], v2 = [next[0] - p[0], next[1] - p[1]];
        var l1 = Math.hypot(v1[0], v1[1]) || 1, l2 = Math.hypot(v2[0], v2[1]) || 1;
        var rr = Math.min(r, l1 / 2, l2 / 2);
        d += ' L' + (p[0] - v1[0] / l1 * rr) + ',' + (p[1] - v1[1] / l1 * rr) +
             ' Q' + p[0] + ',' + p[1] + ' ' + (p[0] + v2[0] / l2 * rr) + ',' + (p[1] + v2[1] / l2 * rr);
      }
      var last = pts[pts.length - 1];
      return d + ' L' + last[0] + ',' + last[1];
    }

    function portOf(n, box, side) {
      if (side === 'r') return { x: n.x + box.w, y: n.y + box.h / 2, nx: 1, ny: 0 };
      if (side === 'l') return { x: n.x, y: n.y + box.h / 2, nx: -1, ny: 0 };
      if (side === 't') return { x: n.x + box.w / 2, y: n.y, nx: 0, ny: -1 };
      return { x: n.x + box.w / 2, y: n.y + box.h, nx: 0, ny: 1 };
    }

    var SIDES = ['r', 'l', 'b', 't'];
    var PORT_ROOM = 44;      // this much clearance in front of a port to look natural

    // All 16 port combinations between two nodes are **scored**, and the cheapest wins.
    //
    // It used to pick one axis first, by asking whether the gap was wider or taller, and tie
    // both ports to that axis. On an ambiguous layout, two nodes on a diagonal for instance,
    // that made the decision a coin flip, and a few px would flip the axis and send the line
    // squeezing out sideways before bending. Scoring fixes no axis, so **out the top and in the left** is available too.
    function pickPorts(a, b, ab, bb) {
      var best = null;
      for (var i = 0; i < SIDES.length; i++) {
        var pa = portOf(a, ab, SIDES[i]);
        for (var j = 0; j < SIDES.length; j++) {
          var pb = portOf(b, bb, SIDES[j]);
          var ex = pb.x + pb.nx * ARROW_GAP, ey = pb.y + pb.ny * ARROW_GAP;
          // How much clearance there is, going out and coming in
          var roomA = (ex - pa.x) * pa.nx + (ey - pa.y) * pa.ny;
          var roomB = (pa.x - ex) * pb.nx + (pa.y - ey) * pb.ny;
          // Two tiers of penalty. **The target sitting behind the port** (negative) means going
          // around, so it weighs heavily. Being in front but merely tight weighs little. Weighing
          // both the same made two nodes side by side, facing each other, take the penalty twice,
          // once from each end, and loop all the way down where a short hop sideways would do.
          var cost = Math.hypot(ex - pa.x, ey - pa.y);
          cost += roomA < 0 ? 120 - roomA * 6 : Math.max(0, PORT_ROOM - roomA) * 1.2;
          cost += roomB < 0 ? 120 - roomB * 6 : Math.max(0, PORT_ROOM - roomB) * 1.2;
          if (!best || cost < best.cost) {
            best = { cost: cost, p1: pa, p2: pb, end: { x: ex, y: ey }, proj: roomA, roomB: roomB };
          }
        }
      }
      return best;
    }

    function edgePath(a, b, ab, bb, lane, route) {
      var pick = pickPorts(a, b, ab, bb);
      var p1 = pick.p1, p2 = pick.p2, end = pick.end, proj = pick.proj;
      var horizontal = Math.abs(p1.nx) === 1;          // is the exit direction horizontal
      var dot = p1.nx * p2.nx + p1.ny * p2.ny;
      var perpendicular = dot === 0;                               // are the ports at right angles
      var facing = dot === -1;                                     // do they face each other
      var span = horizontal ? COL_W * 1.8 : ROW_H * 2.6;

      // proj = how far the target sits straight ahead of the exit port. Less than this means going around.
      // A facing pair is joined even at a slightly negative value. Two nodes a few px apart
      // get a negative proj from the arrow gap (7px) alone, and looping for that is too much.
      var minProj = facing ? -14 : 2;
      var crossOf = horizontal ? Math.abs(end.y - p1.y) : Math.abs(end.x - p1.x);
      // Once the sideways spread is more than twice the head on distance, a curve stops looking
      // right. There is no room to extend the control points, so it folds into an S. That range goes to the orthogonal path.
      // At proj 0 or below (the target slightly behind the port) an orthogonal path cannot meet
      // the entry direction. Only a curve puts the end tangent on the port normal, so that range curves whatever the spread.
      var curvy = proj <= 0 || proj * 2 >= crossOf;
      if (route === 'curve' || (route === 'auto' && curvy && proj > minProj && proj < span)) {
        // Control point length follows the **head on distance (proj)** rather than the straight
        // line distance. Straight line distance sends the control points past each other between
        var k = Math.max(22, Math.min(130, proj * 0.55 + crossOf * 0.16));
        // Control points passing each other along the axis make the curve double back, which
        // reads as one S fold. Clamped to proj so it stays monotonic.
        if (proj > 0) k = Math.min(k, proj * 0.5);
        return {
          d: 'M' + p1.x + ',' + p1.y +
             ' C' + (p1.x + p1.nx * k) + ',' + (p1.y + p1.ny * k) +
             ' ' + (end.x + p2.nx * k) + ',' + (end.y + p2.ny * k) +
             ' ' + end.x + ',' + end.y,
          lx: (p1.x + end.x) / 2, ly: (p1.y + end.y) / 2 - 8
        };
      }

      // An orthogonal path only works when the ports face each other or sit at right angles.
      // A **pair looking the same way** exits and enters in the same direction, so whatever the
      // bends, the last segment runs backwards. That goes to the U below.
      // roomB counts too. A blocked entry side (negative) makes the last segment of an
      // orthogonal path run the wrong way and flips the arrowhead. A detour outside the port is right there.
      if (proj > minProj && pick.roomB > minProj && (facing || perpendicular)) {
        // At right angles there is only one bend, so it joins with a single corner.
        if (perpendicular) {
          var corner = horizontal ? [end.x, p1.y] : [p1.x, end.y];
          return {
            d: roundedPath(dedupe([[p1.x, p1.y], corner, [end.x, end.y]]), 14),
            lx: (p1.x + end.x) / 2, ly: (p1.y + end.y) / 2 - 8
          };
        }
        // The bend has to sit **between** the two ports. Outside, the last segment runs backwards
        // and flips the arrowhead. At small proj the lane jitter used to be carried straight through.
        var s0 = horizontal ? p1.x : p1.y, s1v = horizontal ? end.x : end.y;
        var mid = (s0 + s1v) / 2 + (lane % 3 - 1) * 12;
        var lo = Math.min(s0, s1v) + 8, hi = Math.max(s0, s1v) - 8;
        mid = hi >= lo ? Math.max(lo, Math.min(hi, mid)) : (s0 + s1v) / 2;
        var pts = horizontal
          ? [[p1.x, p1.y], [mid, p1.y], [mid, end.y], [end.x, end.y]]
          : [[p1.x, p1.y], [p1.x, mid], [end.x, mid], [end.x, end.y]];
        return { d: roundedPath(dedupe(pts), 12), lx: (p1.x + end.x) / 2, ly: (p1.y + end.y) / 2 - 8 };
      }

      // From here the target is behind the exit port, so the route goes around, in a lane outside the node.
      // Two vertical (or horizontal) runs close enough to overlap fold into a U, so a minimum gap is opened.
      var out1 = 26 + (lane % 3) * 10, out2 = 30 + (lane % 3) * 10, off = (lane % 4) * 14;
      var MIN_LANE = 46;

      // Ports at right angles. This combination only became possible once port pairs stopped
      // being tied to an axis. Feeding it to the parallel only lane maths below makes **the last
      // segment zero length, so the arrowhead points somewhere else**, and the route swings wide past the target. It is joined separately.
      if (perpendicular) {
        // The distance out is not jittered by lane number here. On overlapping nodes this value
        // is the depth it cuts in, and the same arrangement cutting to different depths depending
        // on edge order looks worse. Short, and the same every time.
        var pOut = 16;
        var s1 = { x: p1.x + p1.nx * pOut, y: p1.y + p1.ny * pOut };
        var s2 = { x: end.x + p2.nx * pOut, y: end.y + p2.ny * pOut };
        var lp = horizontal
          ? [[p1.x, p1.y], [s1.x, s1.y], [s1.x, s2.y], [end.x, s2.y], [end.x, end.y]]
          : [[p1.x, p1.y], [s1.x, s1.y], [s2.x, s1.y], [s2.x, end.y], [end.x, end.y]];
        return {
          d: roundedPath(dedupe(lp), 11),
          lx: (p1.x + end.x) / 2, ly: (p1.y + end.y) / 2 - 8
        };
      }

      // Ports **looking the same way** (down to down, right to right). Common with overlapping nodes.
      // Feeding this to the facing only maths below wraps both nodes and swings round to the far
      // side, more than 200px out. A short U just outside the two ports is right.
      if (!facing) {
        var m = 30 + off;
        if (horizontal) {
          var uX = p1.nx > 0 ? Math.max(a.x + ab.w, b.x + bb.w) + m : Math.min(a.x, b.x) - m;
          return {
            d: roundedPath(dedupe([[p1.x, p1.y], [uX, p1.y], [uX, end.y], [end.x, end.y]]), 12),
            lx: uX, ly: (p1.y + end.y) / 2 - 6
          };
        }
        var uY = p1.ny > 0 ? Math.max(a.y + ab.h, b.y + bb.h) + m : Math.min(a.y, b.y) - m;
        return {
          d: roundedPath(dedupe([[p1.x, p1.y], [p1.x, uY], [end.x, uY], [end.x, end.y]]), 12),
          lx: (p1.x + end.x) / 2, ly: uY + (p1.ny > 0 ? 14 : -6)
        };
      }

      if (horizontal) {
        var ax1 = p1.x + p1.nx * out1, ax2 = end.x + p2.nx * out2;
        if (Math.abs(ax2 - ax1) < MIN_LANE) {
          var mx = (ax1 + ax2) / 2, hx = MIN_LANE / 2;
          ax1 = mx + (p1.nx >= 0 ? hx : -hx);
          ax2 = mx - (p1.nx >= 0 ? hx : -hx);
        }
        var below = (b.y + bb.h / 2) >= (a.y + ab.h / 2);
        var laneY = below ? Math.max(a.y + ab.h, b.y + bb.h) + 32 + off : Math.min(a.y, b.y) - 32 - off;
        return {
          d: roundedPath(dedupe([[p1.x, p1.y], [ax1, p1.y], [ax1, laneY], [ax2, laneY], [ax2, end.y], [end.x, end.y]]), 11),
          lx: (ax1 + ax2) / 2, ly: laneY + (below ? 14 : -6)
        };
      }
      var ay1 = p1.y + p1.ny * out1, ay2 = end.y + p2.ny * out2;
      if (Math.abs(ay2 - ay1) < MIN_LANE) {
        var my = (ay1 + ay2) / 2, hy = MIN_LANE / 2;
        ay1 = my + (p1.ny >= 0 ? hy : -hy);
        ay2 = my - (p1.ny >= 0 ? hy : -hy);
      }
      var right = (b.x + bb.w / 2) >= (a.x + ab.w / 2);
      var laneX = right ? Math.max(a.x + ab.w, b.x + bb.w) + 34 + off : Math.min(a.x, b.x) - 34 - off;
      return {
        d: roundedPath(dedupe([[p1.x, p1.y], [p1.x, ay1], [laneX, ay1], [laneX, ay2], [end.x, ay2], [end.x, end.y]]), 11),
        lx: laneX, ly: (ay1 + ay2) / 2 - 6
      };
    }

    // The path string is flattened to a polyline, and the direction traced back LOOK from the end is returned as an angle.
    //
    // SVG's orient="auto" uses the **instantaneous tangent at the end point**. A curve arriving
    // on a tight bend has a tangent that differs from the direction the eye sees, and the
    // arrowhead alone points elsewhere. Matching the arrowhead to what is visible is simpler than matching the geometry to the arrowhead.
    function tipAngle(d) {
      var toks = d.match(/[MLQC]|-?\d+(?:\.\d+)?/g);
      if (!toks) return null;
      var pts = [], cur = null, cmd = 'M', i = 0;
      function num() { return parseFloat(toks[i++]); }
      function bez3(p0, c1, c2, p3, t) {
        var u = 1 - t;
        return [u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
                u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]];
      }
      function bez2(p0, c, p2, t) {
        var u = 1 - t;
        return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0],
                u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]];
      }
      while (i < toks.length) {
        if (/[MLQC]/.test(toks[i])) { cmd = toks[i++]; continue; }
        if (cmd === 'M' || cmd === 'L') { cur = [num(), num()]; pts.push(cur); }
        else if (cmd === 'Q') {
          var c = [num(), num()], e = [num(), num()];
          for (var t = 1; t <= 6; t++) pts.push(bez2(cur, c, e, t / 6));
          cur = e;
        } else {
          var c1 = [num(), num()], c2 = [num(), num()], e3 = [num(), num()];
          for (var t3 = 1; t3 <= 16; t3++) pts.push(bez3(cur, c1, c2, e3, t3 / 16));
          cur = e3;
        }
      }
      if (pts.length < 2) return null;
      // Traced back from the end, but **only while the direction holds**. Averaging over a fixed
      // length lets the average eat into the curve when the last straight run is shorter than it,
      // and the arrowhead comes out a few degrees off the line.
      // MIN is always traced back. Past that it keeps going only while the direction holds.
      // Cutting at the first bend instead would set the angle from a 1px tail.
      var last = pts[pts.length - 1], MIN = 2, LOOK = 13, acc = 0, ref = pts[pts.length - 2];
      var base = null;
      for (var j = pts.length - 2; j >= 0; j--) {
        var sx = pts[j + 1][0] - pts[j][0], sy = pts[j + 1][1] - pts[j][1];
        var len = Math.hypot(sx, sy);
        if (len < 1e-6) continue;
        var ux = sx / len, uy = sy / len;
        if (base === null) base = [ux, uy];
        else if (acc >= MIN && ux * base[0] + uy * base[1] < 0.9994) break;   // bend of about 2 degrees or more
        ref = pts[j];
        acc += len;
        if (acc >= LOOK) break;
      }
      var dx = last[0] - ref[0], dy = last[1] - ref[1];
      if (!dx && !dy) return null;
      return Math.atan2(dy, dx) * 180 / Math.PI;
    }

    function markerDef(id, type, color, angle) {
      if (type === 'none') return '';
      var body, refX = 9.4;
      if (type === 'open') body = '<path d="M1.5,1 L9,5 L1.5,9" style="fill:none;stroke:' + color + ';stroke-width:1.8"/>';
      else if (type === 'circle') { body = '<circle cx="5" cy="5" r="3.6" style="fill:' + color + '"/>'; refX = 5; }
      else if (type === 'diamond') body = '<polygon points="0,5 5,1.2 10,5 5,8.8" style="fill:' + color + '"/>';
      else if (type === 'tee') { body = '<rect x="3.8" y="0.4" width="2.4" height="9.2" style="fill:' + color + '"/>'; refX = 5; }
      else body = '<polygon points="0,0.7 10,5 0,9.3" style="fill:' + color + '"/>';
      var orient = angle == null ? 'auto-start-reverse' : angle;
      return '<marker id="' + id + '" viewBox="0 0 10 10" refX="' + refX + '" refY="5" ' +
        'markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="' + orient + '">' + body + '</marker>';
    }

    function drawEdges() {
      var box = {};
      g.nodes.forEach(function (n) {
        var el = nodeEl(n.id);
        box[n.id] = { w: el ? el.offsetWidth : 140, h: el ? el.offsetHeight : 44 };
      });
      var defs = '', parts = '', hits = '';
      var selI = sel && sel.t === 'edge' ? sel.i : -1;

      var keep = focusSet();

      g.edges.forEach(function (e, i) {
        var a = nodeById(e.from), b = nodeById(e.to);
        if (!a || !b) return;
        var hl = i === selI || isSel(e.from) || isSel(e.to);
        var dim = keep && !(keep[e.from] && keep[e.to]);
        var color = hl ? 'var(--accent)' : (e.color || 'var(--line-strong)');
        var p = edgePath(a, b, box[e.from], box[e.to], i, e.route || 'auto');
        var arrow = e.arrow || 'triangle';
        var mid = 'mk' + i;
        defs += markerDef(mid, arrow, color, tipAngle(p.d));
        var dash = { dashed: '7 5', dotted: '1.5 4' }[e.style] || '';
        var w = e.width || '1';
        if (e.style !== 'none') {
          parts += '<path class="edge' + (hl ? ' hl' : '') + (dim ? ' dim' : '') + '" d="' + p.d + '"' +
            ' style="stroke:' + color + ';stroke-width:' + (hl ? Number(w) + 0.8 : w) + 'px' +
            (dash ? ';stroke-dasharray:' + dash : '') + '"' +
            (arrow !== 'none' ? ' marker-end="url(#' + mid + ')"' : '') + '/>';
        }
        hits += '<path class="hit" data-i="' + i + '" d="' + p.d + '"/>';
        if (e.label) {
          parts += '<text class="' + (hl ? 'hl' : '') + (dim ? ' dim' : '') + '" x="' + p.lx + '" y="' + p.ly +
            '" text-anchor="middle">' + esc(e.label) + '</text>';
        }
      });
      edgesSvg.innerHTML = '<defs>' + defs + '</defs>' + parts + hits + guideMarkup();
    }

    // ---- snapping. It can be turned off, and it shows the guide the moment it catches
    var snapOn = true, guides = { v: null, h: null };

    function nodeBox(id) {
      var el = nodeEl(id);
      return { w: el ? el.offsetWidth : 180, h: el ? el.offsetHeight : 60 };
    }

    // The world area currently on screen
    function viewRect() {
      var r = stage.getBoundingClientRect();
      return {
        x: -view.tx / view.scale, y: -view.ty / view.scale,
        w: r.width / view.scale, h: r.height / view.scale
      };
    }

    // My left, centre and right go onto another node's left, centre and right (and top, middle, bottom). All 9 combinations.
    // Only the nodes **visible on screen** count. Being pulled toward a node you cannot see
    // leaves no way to know why it caught. With nothing in range it just cleans up the decimals against the fine grid.
    function snapPos(id, x, y) {
      var tol = 9 / view.scale, me = nodeBox(id);
      var vr = viewRect();
      var bx = null, by = null;
      g.nodes.forEach(function (o) {
        if (o.id === id) return;
        var b = nodeBox(o.id);
        if (o.x > vr.x + vr.w || o.x + b.w < vr.x ||
            o.y > vr.y + vr.h || o.y + b.h < vr.y) return;   // off screen
        [o.x, o.x + b.w / 2, o.x + b.w].forEach(function (L) {
          [0, me.w / 2, me.w].forEach(function (A) {
            var pos = L - A, d = Math.abs(pos - x);
            if (d < tol && (!bx || d < bx.d)) bx = { pos: pos, line: L, d: d };
          });
        });
        [o.y, o.y + b.h / 2, o.y + b.h].forEach(function (L) {
          [0, me.h / 2, me.h].forEach(function (A) {
            var pos = L - A, d = Math.abs(pos - y);
            if (d < tol && (!by || d < by.d)) by = { pos: pos, line: L, d: d };
          });
        });
      });
      var GRID = 10;
      return {
        x: bx ? bx.pos : Math.round(x / GRID) * GRID,
        y: by ? by.pos : Math.round(y / GRID) * GRID,
        v: bx ? bx.line : null,
        h: by ? by.line : null
      };
    }

    function guideMarkup() {
      if (guides.v == null && guides.h == null) return '';
      // Guides are drawn right across the screen, which is the range snapping looks at
      var v = viewRect(), s = '';
      if (guides.v != null) {
        s += '<line class="snap-guide" x1="' + guides.v + '" y1="' + v.y +
             '" x2="' + guides.v + '" y2="' + (v.y + v.h) + '"/>';
      }
      if (guides.h != null) {
        s += '<line class="snap-guide" x1="' + v.x + '" y1="' + guides.h +
             '" x2="' + (v.x + v.w) + '" y2="' + guides.h + '"/>';
      }
      return s;
    }

    // ---- inspector (popup on the right). Labels and structure are the document's, so read only.
    var insFolded = false;
    function buildInspect() {
      var n = selNode(), e = selEdge();
      // Not opened when read only. Listing values that cannot be changed only covers the screen.
      // Labels and structure come from the document anyway, so this is not where to look at them.
      if ((!n && !e) || !editable()) { inspect.classList.remove('on'); return; }
      inspect.classList.add('on');
      inspect.classList.toggle('folded', insFolded);
      inspect.innerHTML =
        '<div class="ins-clip"><div class="ins-inner">' +
        '<div class="ins-head" title="' + (insFolded ? 'Expand' : 'Collapse') + '">' +
        '<span class="ins-name">' + (n ? 'Node ' + esc(n.id) : 'Edge') + '</span>' +
        '<span class="sp"></span>' +
        '<span class="ins-chev" data-act="fold">' + (insFolded ? ICON.chevronDown : ICON.chevronUp) + '</span>' +
        '<button data-act="close" title="Clear selection">' + ICON.close + '</button></div>' +
        '<div class="ins-fold"><div class="ins-fold-inner"><div class="ins-body"></div></div></div>' +
        '</div></div>';

      $('[data-act=close]', inspect).addEventListener('click', function (ev) {
        ev.stopPropagation();
        sel = null; draw(); buildInspect();
      });
      // Pressing anywhere on the header collapses it, except the x
      $('.ins-head', inspect).addEventListener('click', function () {
        insFolded = !insFolded;
        inspect.classList.toggle('folded', insFolded);
        this.title = insFolded ? 'Expand' : 'Collapse';
        $('.ins-chev', this).innerHTML = insFolded ? ICON.chevronDown : ICON.chevronUp;
      });
      var body = $('.ins-body', inspect);

      function row(label, control) {
        var r = document.createElement('div');
        r.className = 'ins-row';
        r.innerHTML = '<span class="ins-label">' + label + '</span>';
        r.appendChild(control);
        body.appendChild(r);
      }
      function set(key, val) {
        if (n) { var t = selNode(); if (!t) return; t[key] = val; nodeOv(t.id)[key] = val; }
        else { var x = selEdge(); if (!x) return; x[key] = val; edgeOv(edgeKey(x))[key] = val; }
        draw(); saveOverlay();
      }
      function readonly(text, note) {
        var el = document.createElement('div');
        el.className = 'ins-src';
        el.innerHTML = esc(text) + '<span class="ins-src-note">' + note + '</span>';
        return el;
      }

      function pick(label, options, value, key) {
        row(label, makeDropdown(options, value, function (v) { set(key, v); }));
      }
      function color(label, value, key) {
        row(label, makeSwatches(PALETTE, value, function (c) { set(key, c); }));
      }

      if (n) {
        row('Label', readonly(n.label, 'the document is the original, edit the markdown'));
        pick('Shape', SHAPES, n.shape || 'rect', 'shape');
        color('Background', n.bg, 'bg');
        color('Text', n.fg, 'fg');
        color('Border', n.border, 'border');
        pick('Border style', LINE_STYLES, n.borderStyle || 'solid', 'borderStyle');
        pick('Border width', WIDTHS, String(n.borderWidth || '1'), 'borderWidth');
      } else {
        var from = nodeById(e.from), to = nodeById(e.to);
        var meta = document.createElement('div');
        meta.className = 'ins-edge-meta';
        meta.textContent = (from ? from.label : e.from) + '  →  ' + (to ? to.label : e.to);
        body.appendChild(meta);
        if (e.label) row('Label', readonly(e.label, 'the document is the original'));
        pick('Arrowhead', ARROWS, e.arrow || 'triangle', 'arrow');
        color('Line', e.color, 'color');
        pick('Line style', LINE_STYLES, e.style || 'solid', 'style');
        pick('Line width', WIDTHS, String(e.width || '1'), 'width');
        pick('Route', ROUTES, e.route || 'auto', 'route');
      }
    }

    // ---- minimap. The whole graph shrunk down, with a rectangle marking what is on screen
    function graphBox() {
      var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      g.nodes.forEach(function (n) {
        var el = nodeEl(n.id);
        var w = el ? el.offsetWidth : 180, h = el ? el.offsetHeight : 60;
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
      });
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    // World coordinates to minimap pixels. Keeps a margin and the aspect ratio.
    function mapFrame() {
      var body = $('#cvMapBody');
      if (!body || !g || !g.nodes.length) return null;
      var W = body.clientWidth, H = body.clientHeight;
      if (!W || !H) return null;
      var b = graphBox();
      var pad = 8;
      var s = Math.min((W - pad * 2) / (b.w || 1), (H - pad * 2) / (b.h || 1));
      if (!isFinite(s) || s <= 0) s = 1;
      return {
        W: W, H: H, s: s, box: b,
        ox: (W - b.w * s) / 2 - b.x * s,
        oy: (H - b.h * s) / 2 - b.y * s
      };
    }

    // The minimap is raster, so its colours are baked into pixels and a theme change means
    // redrawing. But while the document view is up, #canvasView is display:none and it cannot
    // be drawn now. When it could not be drawn, that fact is kept and spent on the way back
    // to the canvas. Otherwise it keeps the old theme until some unrelated redraw happens to catch it.
    var mapDirty = false, fitDirty = false;
    // Failing to draw or measure is recorded where it is decided, and spent here when it becomes visible.
    function flushDeferred() {
      if (fitDirty) { fitDirty = false; fit(); }
      if (mapDirty) { mapDirty = false; drawMap(); }
    }
    onRepaint(function () { if (booted && cur >= 0) drawMap(); });

    function drawMap() {
      var cv = $('#cvMapCanvas'), f = mapFrame();
      // Only this place knows the draw failed. Left to the caller, a spin for some other reason
      // (a figure's "show on canvas", which arrives while the view is still display:none) leaves no mark.
      if (!f) { mapDirty = true; return; }
      syncMapVp(f);              // the visible area marker updates regardless of the canvas draw
      if (!cv) return;
      var dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(f.W * dpr) || cv.height !== Math.round(f.H * dpr)) {
        cv.width = Math.round(f.W * dpr); cv.height = Math.round(f.H * dpr);
      }
      var ctx = cv.getContext && cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, f.W, f.H);

      var css = getComputedStyle(document.documentElement);
      var lineC = css.getPropertyValue('--fg-faint').trim() || '#888';
      var nodeC = css.getPropertyValue('--fg-mute').trim() || '#666';
      var accent = css.getPropertyValue('--accent').trim() || '#4a9eff';
      var at = {};
      g.nodes.forEach(function (n) {
        var el = nodeEl(n.id);
        at[n.id] = {
          x: f.ox + n.x * f.s, y: f.oy + n.y * f.s,
          w: Math.max(2, (el ? el.offsetWidth : 180) * f.s),
          h: Math.max(2, (el ? el.offsetHeight : 60) * f.s),
          bg: n.bg, border: n.border
        };
      });

      ctx.globalAlpha = .45; ctx.strokeStyle = lineC; ctx.lineWidth = 1;
      g.edges.forEach(function (e) {
        var a = at[e.from], b = at[e.to];
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x + a.w / 2, a.y + a.h / 2);
        ctx.lineTo(b.x + b.w / 2, b.y + b.h / 2);
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
      g.nodes.forEach(function (n) {
        var p = at[n.id], on = isSel(n.id);
        ctx.fillStyle = on ? accent : (p.bg || nodeC);
        ctx.globalAlpha = on ? 1 : (p.bg ? .9 : .55);
        ctx.fillRect(p.x, p.y, p.w, p.h);
        if (on) { ctx.globalAlpha = 1; ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.strokeRect(p.x, p.y, p.w, p.h); }
      });
      ctx.globalAlpha = 1;
    }

    // Only the visible area is repositioned. This is all that has to run while panning
    function syncMapVp(f) {
      var vp = $('#cvMapVp');
      f = f || mapFrame();
      if (!vp || !f) return;
      var r = stage.getBoundingClientRect();
      var wx = -view.tx / view.scale, wy = -view.ty / view.scale;
      var ww = r.width / view.scale, wh = r.height / view.scale;
      var x = f.ox + wx * f.s, y = f.oy + wy * f.s, w = ww * f.s, h = wh * f.s;
      // Clipped so it does not leak outside the minimap
      var x2 = Math.min(f.W, x + w), y2 = Math.min(f.H, y + h);
      x = Math.max(0, x); y = Math.max(0, y);
      vp.style.left = x + 'px'; vp.style.top = y + 'px';
      vp.style.width = Math.max(0, x2 - x) + 'px';
      vp.style.height = Math.max(0, y2 - y) + 'px';
    }

    // A point on the minimap to the middle of the screen
    function mapCenterOn(px, py) {
      var f = mapFrame();
      if (!f) return;
      var r = stage.getBoundingClientRect();
      var wx = (px - f.ox) / f.s, wy = (py - f.oy) / f.s;
      view.tx = r.width / 2 - wx * view.scale;
      view.ty = r.height / 2 - wy * view.scale;
      world.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.scale + ')';
      syncMapVp(f);
    }

    function fit() {
      if (!g || !g.nodes.length) return;
      var r0 = stage.getBoundingClientRect();
      // The same trap as the minimap. A figure's "show on canvas" calls canvas.open
      // synchronously, ahead of setView's 130ms delay, while the view is still display:none.
      // Computing at 0x0 and going as far as persistView stores that scale, and the re-fit guard then keeps it forever.
      if (!r0.width || !r0.height) { fitDirty = true; return; }
      var b = graphBox();
      var minX = b.x, minY = b.y, maxX = b.x + b.w, maxY = b.y + b.h;
      var r = r0;
      var s = Math.min((r.width - 100) / (maxX - minX), (r.height - 100) / (maxY - minY), 1.4);
      view.scale = isFinite(s) && s > 0 ? Math.max(0.12, s) : 1;
      view.tx = 50 - minX * view.scale;
      view.ty = 50 - minY * view.scale;
      draw(); persistView();
    }
    function persistView() {
      if (cur < 0 || !editable()) return;
      slot().view = { tx: view.tx, ty: view.ty, scale: view.scale };
      saveOverlay();
    }
    function zoomBy(k) {
      var r = stage.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2;
      var ns = Math.max(0.12, Math.min(3, view.scale * k));
      view.tx = cx - (cx - view.tx) * (ns / view.scale);
      view.ty = cy - (cy - view.ty) * (ns / view.scale);
      view.scale = ns;
      draw(); persistView();
    }

    // ---- diagram list on the left
    function renderList() {
      if (!GRAPHS.length) {
        listEl.innerHTML = '<div class="gl-empty">This document has no diagrams.<br>' +
          'Add a <code>```mermaid</code> graph block.</div>';
        return;
      }
        listEl.innerHTML = '<div class="gl"><div class="gl-kicker">Diagrams ' + GRAPHS.length + '</div></div>';
      var box = $('.gl', listEl);
      GRAPHS.forEach(function (blk, i) {
        var p = parseGraph(blk.src);
        var b = document.createElement('button');
        b.className = 'gl-item' + (i === cur ? ' on' : '');
        b.innerHTML = esc(blk.label) +
          '<span class="gl-meta">' + p.nodes.length + ' nodes, ' + p.edges.length + ' edges</span>';
        b.addEventListener('click', function () { open(i); });
        box.appendChild(b);
      });
    }

    function open(i) {
      if (!GRAPHS.length) return;
      i = Math.max(0, Math.min(GRAPHS.length - 1, i || 0));
      build(i);
      $('#cvTitle').textContent = GRAPHS[i].label;
      $('#cvEmpty').style.display = g.nodes.length ? 'none' : 'flex';
      $('#cvMap').classList.toggle('on', g.nodes.length > 1);
      renderList();
      buildInspect();
      draw();
      if (!(slot().view && slot().view.scale)) fit();
      $('#cvToDoc').style.display = (GRAPHS[i].heading && HEADING_ID[GRAPHS[i].heading]) ? '' : 'none';
      applyLock();
    }

    // Locking differs per diagram, so it is decided where the diagram opens. Snapping is a
    // property of dragging and reset throws away stored changes, so on a locked diagram neither has anything to point at.
    function applyLock() {
      var lock = !editable();
      document.body.classList.toggle('cv-readonly', lock);
      var badge = $('#cvReadonly');
      badge.style.display = lock ? '' : 'none';
      badge.title = lock ? lockReason() : '';
      $('#cvSnap').style.display = lock ? 'none' : '';
      $('#cvReset').style.display = lock ? 'none' : '';
    }

    function bind() {
      var panning = false, sx = 0, sy = 0, otx = 0, oty = 0, moved = false;
      var drag = { on: false };

      // Shift and a drag over empty canvas picks everything the box touches. Without the
      // shift the same drag pans, which is the older and more common of the two.
      var band = null;
      function bandRect(e) {
        var r = stage.getBoundingClientRect();
        return {
          left: Math.min(band.x, e.clientX), top: Math.min(band.y, e.clientY),
          right: Math.max(band.x, e.clientX), bottom: Math.max(band.y, e.clientY), host: r
        };
      }
      stage.addEventListener('mousedown', function (e) {
        if (e.target.closest('.cv-node') || e.target.closest('.hit') || e.target.closest('.cv-inspect')) return;
        if (e.target.closest('.cv-frame-name')) return;
        if (e.shiftKey) {
          band = { x: e.clientX, y: e.clientY, el: document.createElement('div') };
          band.el.className = 'cv-band';
          stage.appendChild(band.el);
          document.body.classList.add('cv-dragging');
          e.preventDefault();
          return;
        }
        panning = true; moved = false; stage.classList.add('panning');
        document.body.classList.add('cv-dragging');
        sx = e.clientX; sy = e.clientY; otx = view.tx; oty = view.ty;
        e.preventDefault();   // stops the browser's own text selection and drag
      });
      world.addEventListener('mousedown', function (e) {
        var hit = e.target.closest('.hit');
        if (hit) {
          e.stopPropagation(); e.preventDefault();
          sel = { t: 'edge', i: Number(hit.dataset.i) };
          draw(); buildInspect();
          return;
        }
        // The name on a subgraph frame is the handle for the whole group. The frame itself
        // takes no pointer, so dragging across it still pans.
        var tag = e.target.closest('.cv-frame-name');
        if (tag) {
          e.stopPropagation(); e.preventDefault();
          var name = tag.parentElement.dataset.group;
          var mine = groupIds(name);
          if (!mine.length) return;
          // The group is what is picked, not the nodes in it. The frame carries the mark and
          // the nodes stay as they are, which is the difference between focusing a subgraph
          // and selecting everything inside it.
          sel = { t: 'group', name: name };
          startDrag(mine[0], e, mine);
          draw(); buildInspect();
          return;
        }
        var el = e.target.closest('.cv-node');
        if (!el) return;
        e.stopPropagation(); e.preventDefault();
        var id = el.dataset.id;
        // Shift picks one more, or drops one already picked. It never starts a drag, so a
        // selection can be built up without the nodes moving under the pointer.
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          var ids = selIds().slice(), was = ids.indexOf(id);
          if (was >= 0) ids.splice(was, 1); else ids.push(id);
          sel = ids.length ? { t: 'node', ids: ids } : null;
          draw(); buildInspect();
          return;
        }
        // Pressing one that is already picked keeps the rest, which is what makes a group of
        // them draggable. Released without moving, it falls back to that one alone.
        if (!isSel(id)) sel = { t: 'node', ids: [id] };
        startDrag(id, e);
        // Redrawn through draw(). Swapping the sel class alone leaves focus dimming on the old selection
        draw();
        buildInspect();
      });

      // Selection lives even when read only. *Looking* at properties is not editing. Only moving is blocked.
      function startDrag(id, e, ids) {
        if (!editable()) return;
        document.body.classList.add('cv-dragging');
        drag = {
          on: true, id: id, sx: e.clientX, sy: e.clientY, moved: false,
          from: (ids || selIds()).map(function (k) { var n = nodeById(k); return { id: k, x: n.x, y: n.y }; })
        };
      }
      window.addEventListener('mousemove', function (e) {
        if (band) {
          var r = bandRect(e);
          band.el.style.left = (r.left - r.host.left) + 'px';
          band.el.style.top = (r.top - r.host.top) + 'px';
          band.el.style.width = (r.right - r.left) + 'px';
          band.el.style.height = (r.bottom - r.top) + 'px';
        }
        if (panning) {
          if (Math.abs(e.clientX - sx) > 3 || Math.abs(e.clientY - sy) > 3) moved = true;
          view.tx = otx + (e.clientX - sx); view.ty = oty + (e.clientY - sy);
          world.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.scale + ')';
          syncMapVp();
        }
        if (drag.on) {
          var lead = null;
          drag.from.forEach(function (f) { if (f.id === drag.id) lead = f; });
          var rx = lead.x + (e.clientX - drag.sx) / view.scale;
          var ry = lead.y + (e.clientY - drag.sy) / view.scale;
          if (Math.abs(e.clientX - drag.sx) > 2 || Math.abs(e.clientY - drag.sy) > 2) drag.moved = true;
          if (snapOn) {
            var sp = snapPos(drag.id, rx, ry);
            rx = sp.x; ry = sp.y; guides = { v: sp.v, h: sp.h };
          } else {
            guides = { v: null, h: null };
          }
          // The one under the pointer decides the step and the rest of the picked nodes take
          // the same one, so what was picked keeps its shape.
          var dx = rx - lead.x, dy = ry - lead.y;
          drag.from.forEach(function (f) {
            var n = nodeById(f.id);
            n.x = f.x + dx; n.y = f.y + dy;
            var el = nodeEl(f.id);
            if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
          });
          drawFrames(); drawEdges(); drawMap();
        }
      });
      window.addEventListener('mouseup', function (e) {
        document.body.classList.remove('cv-dragging');
        if (band) {
          var r = bandRect(e);
          var hits = [];
          g.nodes.forEach(function (n) {
            var el = nodeEl(n.id);
            if (!el) return;
            var b = el.getBoundingClientRect();
            if (b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom) hits.push(n.id);
          });
          band.el.remove();
          band = null;
          sel = hits.length ? { t: 'node', ids: hits } : null;
          draw(); buildInspect();
        }
        if (panning) {
          panning = false; stage.classList.remove('panning');
          if (!moved && sel) { sel = null; draw(); buildInspect(); }
          persistView();
        }
        if (drag.on) {
          drag.from.forEach(function (f) {
            var n = nodeById(f.id), o = nodeOv(f.id);
            o.x = n.x; o.y = n.y;
          });
          var picked = drag.id, still = drag.moved;
          drag.on = false; saveOverlay();
          guides = { v: null, h: null };
          if (!still && selIds().length > 1) { sel = { t: 'node', ids: [picked] }; draw(); buildInspect(); }
          drawEdges();
        }
      });

      stage.addEventListener('wheel', function (e) {
        if (e.target.closest('.cv-inspect')) return;
        e.preventDefault();
        var r = stage.getBoundingClientRect();
        var mx = e.clientX - r.left, my = e.clientY - r.top;
        var ns = Math.max(0.12, Math.min(3, view.scale * Math.exp(-e.deltaY * 0.0015)));
        view.tx = mx - (mx - view.tx) * (ns / view.scale);
        view.ty = my - (my - view.ty) * (ns / view.scale);
        view.scale = ns;
        draw(); persistView();
      }, { passive: false });

      // ---- minimap: collapse from the header, click and drag the body to move
      var mapEl = $('#cvMap'), mapBody = $('#cvMapBody');
      function renderMapChev() {
        $('#cvMapChev').innerHTML = mapFolded ? ICON.chevronUp : ICON.chevronDown;
        $('#cvMapHead').title = mapFolded ? 'Expand the minimap' : 'Collapse the minimap';
      }
      mapEl.classList.toggle('folded', mapFolded);
      renderMapChev();
      $('#cvMapHead').addEventListener('click', function () {
        mapFolded = !mapFolded;
        mapEl.classList.toggle('folded', mapFolded);
        renderMapChev();
        try { localStorage.setItem(MAP_KEY, mapFolded ? '1' : '0'); } catch (err) { }
        if (!mapFolded) setTimeout(drawMap, 250);   // measured after the expand animation ends
      });

      var mapDrag = false;
      function mapPoint(e) {
        var r = mapBody.getBoundingClientRect();
        mapCenterOn(e.clientX - r.left, e.clientY - r.top);
      }
      mapBody.addEventListener('mousedown', function (e) {
        e.stopPropagation(); e.preventDefault();
        mapDrag = true;
        document.body.classList.add('cv-dragging', 'cvm-dragging');
        mapPoint(e);
      });
      window.addEventListener('mousemove', function (e) { if (mapDrag) mapPoint(e); });
      window.addEventListener('mouseup', function () {
        if (!mapDrag) return;
        mapDrag = false;
        document.body.classList.remove('cvm-dragging');
        persistView();
      });
      mapBody.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
      window.addEventListener('resize', function () { drawMap(); });

      $('#cvFit').addEventListener('click', fit);
      $('#cvZoomIn').addEventListener('click', function () { zoomBy(1.2); });
      $('#cvZoomOut').addEventListener('click', function () { zoomBy(1 / 1.2); });
      $('#cvFocus').addEventListener('click', function () {
        focusOn = !focusOn;
        this.classList.toggle('on', focusOn);
        if (focusOn && !sel) toast('pick a node or an edge to keep only its neighbours');
        draw();
      });
      $('#cvSnap').classList.toggle('on', snapOn);
      $('#cvSnap').addEventListener('click', function () {
        snapOn = !snapOn;
        this.classList.toggle('on', snapOn);
        try { localStorage.setItem(SNAP_KEY, snapOn ? '1' : '0'); } catch (err) { }
        toast(snapOn ? 'snapping on' : 'snapping off');
      });
      $('#cvToDoc').addEventListener('click', function () { jumpToHeading(GRAPHS[cur].heading); });
      $('#cvReset').addEventListener('click', function () {
        if (!confirm('Drop the layout and style changes on "' + GRAPHS[cur].label + '" and go back to the document?')) return;
        delete overlay[GRAPHS[cur].key];
        saveOverlay();
        open(cur);
        fit();
        toast('back to the document');
      });
      $('#cvSave').addEventListener('click', function () {
        download(fileBase + '-canvas.json', JSON.stringify(overlay, null, 2), 'application/json');
      });
      $('#cvLoad').addEventListener('change', function (e) {
        var f = e.target.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try {
            var s = JSON.parse(rd.result);
            if (!s || typeof s !== 'object') throw new Error('not the right shape');
            overlay = s; saveOverlay(); open(cur); toast('loaded');
          } catch (err) { toast('load failed: ' + err.message); }
        };
        rd.readAsText(f);
        e.target.value = '';
      });
    }

    return {
      ensure: function (i) {
        if (booted) { flushDeferred(); return; }
        booted = true;
        stage = $('#cvStage'); world = $('#cvWorld'); edgesSvg = $('#cvEdges');
        inspect = $('#cvInspect'); listEl = $('#graphList');
        try {
          mapFolded = localStorage.getItem(MAP_KEY) === '1';
          snapOn = localStorage.getItem(SNAP_KEY) !== '0';   // on by default
        } catch (e) { }
        loadOverlay();
        renderList();
        if (!GRAPHS.length) { $('#cvEmpty').style.display = 'flex'; return; }
        bind();
        // The caller decides what to open. Opening index 0 here and calling fit() would
        // override the restore rules inside open() and lose the stored scale and position.
        open(i || 0);
      },
      open: function (i) {
        if (!booted) { this.ensure(i); return; }
        if (GRAPHS.length) open(i);
      }
    };
  })();

  setView('doc');
  if (location.hash) {
    var t = document.getElementById(location.hash.slice(1));
    if (t) setTimeout(function () { t.scrollIntoView(); }, 60);
  }
})();
