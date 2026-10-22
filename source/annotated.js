/* analysis-doc annotated figures. ```annotated is one drawing written in HTML with numbered
 * notes that point at parts of it; ```cards is several drawings side by side, each with its
 * fields. The drawing is the document's own HTML (canvas, svg and scripts included). This
 * file gives it a frame, the ui-* classes, and the annotations.
 * In: the text of the block. Out: markup and scripts for a shadow root (draw), then the root
 * itself with scripts run and layout and hover wired (mount).
 */
window.Annotated = (function () {
  'use strict';

  var PRESETS = ['default', 'ios', 'material', 'toss'];
  var FRAMES = ['phone', 'browser', 'none'];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function trim(s) { return String(s).trim(); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  // ---------------------------------------------------------------- icons
  // 24 unit boxes. They reach a drawing as `.ui-icon.<name>`, a mask over currentColor.
  var ICONS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    down: '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
    share: '<path d="M12 3.5v11M7.5 8L12 3.5 16.5 8M5 12.5v6.5a1 1 0 001 1h12a1 1 0 001-1v-6.5"/>',
    more: '<circle class="f" cx="5.5" cy="12" r="1.7"/><circle class="f" cx="12" cy="12" r="1.7"/><circle class="f" cx="18.5" cy="12" r="1.7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/><circle cx="12" cy="12" r="6.6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 00-2-2h-7a2 2 0 00-2 2v7a2 2 0 002 2h2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0111 0v5.5l1.5 2h-14z"/><path d="M10 20.5a2 2 0 004 0"/>',
    home: '<path d="M4 11l8-7 8 7v8.5a.5.5 0 01-.5.5H15v-6H9v6H4.5a.5.5 0 01-.5-.5z"/>',
    gift: '<rect x="4" y="9" width="16" height="4" rx="1"/><path d="M5.5 13v7h13v-7M12 9v11M12 9C10.5 6 7 5.5 7 7.5S10.5 9 12 9c1.5 0 5 .5 5-1.5S13.5 6 12 9"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle class="f" cx="12" cy="7.8" r="1.2"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5"/><circle class="f" cx="12" cy="17.3" r="1.1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.4 2.4 0 114 1.8c-.9.7-1.6 1.2-1.6 2.6"/><circle class="f" cx="12" cy="17" r="1.1"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0112 7.3a4.2 4.2 0 017.5 2.5C19.5 15.4 12 20 12 20z"/>',
    star: '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
    user: '<circle cx="12" cy="8.5" r="3.7"/><path d="M5 20a7 7 0 0114 0"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
    refresh: '<path d="M19 12a7 7 0 11-2.1-5M19 4.5V9h-4.5"/>',
    edit: '<path d="M5 19h4L19 9l-4-4L5 15z"/><path d="M13 7l4 4"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17.5l5-5 4 4 2.5-2.5 4.5 4"/>',
    filter: '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
    bank: '<path d="M3 9.5L12 4l9 5.5M5 10.5v7M9.5 10.5v7M14.5 10.5v7M19 10.5v7M3 20h18"/>',
    wallet: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 9.5h13a1 1 0 011 1v1"/><circle class="f" cx="16" cy="13.5" r="1.2"/>',
    chat: '<path d="M5 5h14v10H9.5L5 19z"/>',
    pin: '<path d="M12 21s-6-6.2-6-11a6 6 0 0112 0c0 4.8-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5z"/>',
    external: '<path d="M10 5H6a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-4M14 4.5h5.5V10M19.5 4.5L11 13"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>'
  };

  function iconUrl(body) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      body.replace(/class="f"/g, 'fill="#000" stroke="none"') + '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27') + '")';
  }
  var ICON_CSS = Object.keys(ICONS).map(function (k) { return '.ui-icon.' + k + '{--icon:' + iconUrl(ICONS[k]) + '}'; }).join('\n');

  // The phone's own chrome, not something a drawing picks.
  var STATUS = '<div class="sf-status"><b>9:41</b><i></i><span>' +
    '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>' +
    '<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.6c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 008 .8 10.6 10.6 0 00.5 3.8l1.3 1.3A8.7 8.7 0 018 2.6zm0 3.6c1.4 0 2.7.5 3.7 1.5L13 6.4a7 7 0 00-10 0l1.3 1.3c1-1 2.3-1.5 3.7-1.5zm0 3.5a1.6 1.6 0 00-1.2.5L8 11.5l1.2-1.3A1.6 1.6 0 008 9.7z"/></svg>' +
    '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.5"/><path d="M25 4.5v4a2 2 0 000-4z" opacity=".45"/></svg>' +
    '</span></div>';

  // ---------------------------------------------------------------- reading the block
  // Indentation makes the tree: the figure's lines (`frame:`, `html:`), its entries
  // (`- name`), and each entry's lines. Only depth relative to the parent matters.
  function outline(lines) {
    var root = { depth: -1, children: [] }, stack = [root];
    lines.forEach(function (raw, at) {
      if (!raw.trim()) return;
      var depth = raw.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
      var node = { text: raw.trim(), at: at, depth: depth, children: [] };
      while (stack[stack.length - 1].depth >= depth) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    });
    return root.children;
  }

  // The source lines a run of nodes spans, blank ones included, with the indentation they
  // have relative to the first of them.
  function rawLines(nodes, lines) {
    if (!nodes.length) return '';
    var last = nodes[nodes.length - 1];
    while (last.children.length) last = last.children[last.children.length - 1];
    var out = lines.slice(nodes[0].at, last.at + 1);
    var base = out[0].match(/^[ \t]*/)[0].length;
    return out.map(function (l) { return l.slice(Math.min(base, l.match(/^[ \t]*/)[0].length)); }).join('\n');
  }

  // name | type | meaning. Only the first two `|` separate, and none inside quotes or a code
  // span, so a meaning keeps its pipes and a type like `"A" | "B"` can be written in backticks.
  function splitField(value) {
    var parts = [], cur = '', quoted = '', i;
    for (i = 0; i < value.length; i++) {
      var ch = value[i];
      if (quoted) { if (ch === quoted) quoted = ''; }
      else if (ch === '"' || ch === '`') quoted = ch;
      else if (ch === '|' && parts.length < 2) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    return parts.map(trim);
  }

  // `at: #sel`, `at: #sel x, y, w, h` (a box inside that element), `at: x, y, w, h` (a box
  // in the drawing). Units are CSS pixels of the drawing as laid out.
  var AT_RE = /^(.*?)\s*(?:(-?[\d.]+)\s*[,\s]\s*(-?[\d.]+)\s*[,\s]\s*(-?[\d.]+)\s*[,\s]\s*(-?[\d.]+))?$/;
  function parseAt(value) {
    var m = trim(value).match(AT_RE);
    return { sel: m[1], box: m[2] != null ? [m[2], m[3], m[4], m[5]].map(Number) : null, source: trim(value) };
  }

  var ENTRY_RE = /^-\s+(.*?)(?:\s+\[(planned)\])?\s*$/i;
  var KEY_RE = /^([a-z]+)\s*:\s*(.*)$/i;
  // Lines before the first entry, by figure, and the lines an entry takes.
  var FIGURE_KEYS = { annotated: { frame: 1, width: 1, url: 1, html: 1 }, cards: {} };
  var ENTRY_KEYS = { annotated: { at: 1, note: 1 }, cards: { note: 1, html: 1, field: 1 } };

  function parse(kind, src, warn) {
    var lines = String(src).split('\n'), opts = {}, entries = [], html = null;
    outline(lines).forEach(function (n) {
      var em = n.text.match(ENTRY_RE);
      if (em) { entries.push(parseEntry(kind, em[1], !!em[2], n.children, lines, warn)); return; }
      var km = n.text.match(KEY_RE), key = km ? km[1].toLowerCase() : '';
      if (km && FIGURE_KEYS[kind][key] && !entries.length) {
        if (key === 'html') html = (trim(km[2]) ? trim(km[2]) + '\n' : '') + rawLines(n.children, lines);
        else opts[key] = trim(km[2]);
        return;
      }
      warn('not read: ' + n.text);
    });
    return { opts: opts, entries: entries, html: html };
  }

  function parseEntry(kind, name, planned, children, lines, warn) {
    var e = { name: name, planned: planned, at: null, notes: [], fields: [], html: null };
    children.forEach(function (c) {
      var km = c.text.match(KEY_RE);
      var key = km ? km[1].toLowerCase() : '', value = km ? trim(km[2]) : '';
      if (!ENTRY_KEYS[kind][key]) warn(name + ': not read: ' + c.text);
      else if (key === 'at') e.at = parseAt(value);
      else if (key === 'note') e.notes.push(value);
      else if (key === 'field') e.fields.push(splitField(value));
      else e.html = (value ? value + '\n' : '') + rawLines(c.children, lines);
    });
    return e;
  }

  // ---------------------------------------------------------------- drawings
  // A drawing's <style> is rewritten so every selector starts at that drawing. The
  // annotations share the shadow root, and a `div { }` in a drawing must not reach them.
  function splitSelectors(s) {
    var out = [], depth = 0, quoted = '', cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (quoted) { if (ch === quoted) quoted = ''; }
      else if (ch === '"' || ch === "'") quoted = ch;
      else if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (ch === ',' && !depth) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(trim).filter(Boolean);
  }

  function scopeCss(css, scope) {
    var sheet;
    try { sheet = new CSSStyleSheet(); sheet.replaceSync(css); } catch (e) { return ''; }
    function walk(list) {
      return Array.prototype.map.call(list, function (rule) {
        if (rule.selectorText != null && rule.style) {
          rule.selectorText = splitSelectors(rule.selectorText).map(function (sel) {
            return /^(:root|html|body)(?![\w(-])/.test(sel) ? sel.replace(/^(:root|html|body)/, scope) : scope + ' ' + sel;
          }).join(', ');
          // The browser keeps the old selector when the new one does not parse, and the old
          // one is unscoped, so a rule that did not take is dropped.
          var took = splitSelectors(rule.selectorText).every(function (sel) { return sel.indexOf(scope) === 0; });
          return took ? rule.cssText : '';
        }
        if (rule.cssRules && !(window.CSSKeyframesRule && rule instanceof CSSKeyframesRule)) {
          return rule.cssText.slice(0, rule.cssText.indexOf('{')) + '{' + walk(rule.cssRules) + '}';
        }
        return rule.cssText;
      }).join('\n');
    }
    return walk(sheet.cssRules);
  }

  // Markup for one drawing, with its scripts set aside to run once it is in the page.
  // `assets` maps a relative path the document wrote to the data URL the build made of it.
  function drawing(source, id, ctx) {
    var t = document.createElement('template');
    t.innerHTML = source || '';
    var css = '';
    each(t.content.querySelectorAll('style'), function (el) { css += el.textContent + '\n'; el.remove(); });
    each(t.content.querySelectorAll('script'), function (el) {
      if (el.getAttribute('src')) ctx.warn('a script with src is not run. write it inline: ' + el.getAttribute('src'));
      else ctx.scripts.push({ id: id, code: el.textContent });
      el.remove();
    });
    each(t.content.querySelectorAll('[src], [href], [poster]'), function (el) {
      ['src', 'href', 'poster'].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && ctx.assets[v]) el.setAttribute(a, ctx.assets[v]);
      });
    });
    var scope = '[data-d="' + id + '"]';
    return (css ? '<style>' + scopeCss(css, scope) + '</style>' : '') +
      '<div class="sf-drawing" data-d="' + id + '">' + t.innerHTML + '</div>';
  }

  // ---------------------------------------------------------------- figures
  function tag(planned) { return planned ? '<span class="sf-tag">planned</span>' : ''; }

  function annotated(model, ctx) {
    var frame = (model.opts.frame || 'phone').toLowerCase();
    if (FRAMES.indexOf(frame) < 0) { ctx.warn('frame: "' + frame + '" is not ' + FRAMES.join(', ')); frame = 'phone'; }
    if (model.html == null) ctx.warn('no html: block, so there is nothing to draw');
    var width = Number(model.opts.width) || 0;
    var screenStyle = width && frame !== 'phone' ? ' style="width:' + width + 'px"' : '';
    model.entries.forEach(function (e) { if (!e.at) ctx.warn(e.name + ': no at:, so it points at nothing'); });
    var marks = '', badges = '', notes = '';
    model.entries.forEach(function (e, i) {
      var n = i + 1;
      marks += '<div class="sf-mark' + (e.planned ? ' planned' : '') + '" data-n="' + n + '"></div>';
      badges += '<div class="sf-badge" data-n="' + n + '">' + n + '</div>';
      notes += '<li class="sf-note" data-n="' + n + '"><span class="sf-num" data-n="' + n + '">' + n + '</span><div>' +
        '<div class="sf-note-name">' + esc(e.name) + tag(e.planned) + '</div>' +
        e.notes.map(function (l) { return '<div class="sf-note-line">' + ctx.inline(l) + '</div>'; }).join('') + '</div></li>';
    });
    var device = frame === 'phone' ? 'sf-phone' : frame === 'browser' ? 'sf-browser' : 'sf-bare';
    return '<div class="sf-stage">' +
      '<div class="sf-device ' + device + '">' +
        (frame === 'browser' ? '<div class="sf-chrome"><i></i><i></i><i></i><span>' + esc(model.opts.url || '') + '</span></div>' : '') +
        '<div class="sf-screen"' + screenStyle + '>' + (frame === 'phone' ? STATUS : '') +
          drawing(model.html, 0, ctx) + (frame === 'phone' ? '<div class="sf-home"></div>' : '') + '</div>' +
        '<div class="sf-marks">' + marks + '</div></div>' +
      '<svg class="sf-leaders"></svg>' + badges + '<ol class="sf-notes">' + notes + '</ol></div>';
  }

  function cards(model, ctx) {
    return '<div class="sf-cards">' + model.entries.map(function (e, i) {
      return '<div class="sf-cardbox"><div class="sf-cardbox-head"><div class="sf-cardbox-name">' + esc(e.name) + tag(e.planned) + '</div>' +
        e.notes.map(function (l) { return '<div class="sf-card-note">' + ctx.inline(l) + '</div>'; }).join('') + '</div>' +
        (e.html != null ? '<div class="sf-preview' + (e.planned ? ' planned' : '') + '">' + drawing(e.html, i, ctx) + '</div>' : '') +
        (e.fields.length ? '<table class="sf-fields"><thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead><tbody>' +
          e.fields.map(function (f) {
            return '<tr><td>' + esc(f[0] || '') + '</td><td class="type">' + ctx.inline(f[1] || '') + '</td><td>' + ctx.inline(f[2] || '') + '</td></tr>';
          }).join('') + '</tbody></table>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  // One figure, ready to mount.
  //   kind: 'annotated' | 'cards'
  //   options.inline: renders a line of inline markdown (notes, field types and meanings)
  //   options.preset: the document's ui-theme
  //   options.assets: relative path -> data URL, for the images a drawing names
  // Returns { markup, scripts, entries }.
  function draw(kind, src, options) {
    var warnings = [];
    var ctx = { inline: options.inline, assets: options.assets || {}, scripts: [], warn: function (w) { warnings.push(w); } };
    var preset = options.preset || 'default';
    if (PRESETS.indexOf(preset) < 0) {
      ctx.warn('ui-theme "' + preset + '" is not a preset (' + PRESETS.join(', ') + '). drawn with default');
      preset = 'default';
    }
    var model = parse(kind, src, ctx.warn);
    var body = kind === 'cards' ? cards(model, ctx) : annotated(model, ctx);
    return {
      markup: '<div class="sf" data-preset="' + preset + '"><div class="sf-warn">' + warnings.map(esc).join('\n') + '</div>' + body + '</div>',
      scripts: ctx.scripts,
      entries: model.entries
    };
  }

  // ---------------------------------------------------------------- layout
  var GUTTER = 60, NOTE_MIN = 180, BADGE_STEP = 26;

  // Where each entry points, in the device's own pixels. A drawing scaled by the enlarged
  // view is measured through the device's scale, so the result does not depend on it.
  function targets(root, fig) {
    var device = root.querySelector('.sf-device'), d = root.querySelector('.sf-drawing');
    var dr = device.getBoundingClientRect(), scale = dr.width / device.offsetWidth || 1;
    return fig.entries.map(function (e) {
      if (!e.at) return null;
      var el = e.at.sel ? d.querySelector(e.at.sel) : d;
      if (!el) return { missing: true };
      var r = el.getBoundingClientRect();
      var box = { el: el, sub: !!e.at.box, x: (r.left - dr.left) / scale, y: (r.top - dr.top) / scale, w: r.width / scale, h: r.height / scale };
      if (e.at.box) { box.x += e.at.box[0]; box.y += e.at.box[1]; box.w = e.at.box[2]; box.h = e.at.box[3]; }
      return box;
    });
  }

  // Marks cover what each entry points at, badges stand outside the device level with it,
  // and the notes run beside in the order of the badges, each starting level with its badge
  // unless the one above pushes it down.
  function layout(root, fig) {
    var stage = root.querySelector('.sf-stage');
    if (!stage || !stage.clientWidth) return;
    var device = stage.querySelector('.sf-device');
    var marks = root.querySelectorAll('.sf-mark'), badges = root.querySelectorAll('.sf-badge');
    var notes = root.querySelectorAll('.sf-note'), list = root.querySelector('.sf-notes');
    var svg = root.querySelector('.sf-leaders');
    var W = stage.clientWidth, dw = device.offsetWidth;
    var stacked = W < dw + GUTTER + NOTE_MIN;
    stage.classList.toggle('stacked', stacked);
    stage.style.minHeight = '';
    var bx = stacked ? dw - 13 : dw + 28, nx = dw + GUTTER;
    list.style.left = stacked ? '' : nx + 'px';
    list.style.width = stacked ? '' : (W - nx) + 'px';

    var boxes = targets(root, fig), missing = [];
    fig.found = boxes;
    // A leader meets a short target at its middle and a tall one near its top, so a container
    // and the parts inside it come out in reading order.
    var anchor = function (b) { return b.y + Math.min(b.h / 2, 24); };
    var order = boxes.map(function (b, i) { return i; }).filter(function (i) { return boxes[i] && !boxes[i].missing; });
    order.sort(function (a, b) { return anchor(boxes[a]) - anchor(boxes[b]) || a - b; });
    boxes.forEach(function (b, i) {
      var on = b && !b.missing;
      marks[i].classList.toggle('off', !on);
      marks[i].classList.toggle('box', !!(on && b.sub));
      badges[i].classList.toggle('off', !on);
      if (b && b.missing) missing.push(fig.entries[i].name + ': at: ' + fig.entries[i].at.source + ' finds nothing in the drawing');
      if (!on) return;
      marks[i].style.left = b.x + 'px'; marks[i].style.top = b.y + 'px';
      marks[i].style.width = Math.max(4, b.w) + 'px'; marks[i].style.height = Math.max(4, b.h) + 'px';
    });
    live(root, missing);

    var lastBadge = -Infinity, lastNote = 0, paths = '';
    order.forEach(function (i) {
      var b = boxes[i], cy = anchor(b), by = Math.max(cy, lastBadge + BADGE_STEP), n = i + 1;
      lastBadge = by;
      badges[i].style.left = bx + 'px'; badges[i].style.top = by + 'px';
      if (stacked) return;
      var ny = Math.max(by - 20, lastNote);
      notes[i].style.top = ny + 'px';
      lastNote = ny + notes[i].offsetHeight + 8;
      var edge = Math.min(dw + 4, b.x + b.w);
      paths += '<path data-n="' + n + '" d="M' + (dw + 4) + ' ' + cy + 'L' + (bx - 11) + ' ' + by + '"/>' +
        '<path data-n="' + n + '" d="M' + (bx + 11) + ' ' + by + 'H' + (nx - 8) + 'V' + (ny + 20) + 'H' + nx + '"/>';
      if (!b.sub && edge < dw - 6) paths += '<path data-n="' + n + '" d="M' + edge + ' ' + cy + 'H' + (dw + 4) + '"/>';
    });
    // Entries that point at nothing still list their note, after the rest.
    if (!stacked) {
      boxes.forEach(function (b, i) {
        if (b && !b.missing) return;
        notes[i].style.top = lastNote + 'px';
        lastNote += notes[i].offsetHeight + 8;
      });
      stage.style.minHeight = Math.max(device.offsetHeight, lastNote) + 'px';
    }
    svg.setAttribute('width', W);
    svg.setAttribute('height', stage.offsetHeight);
    svg.innerHTML = paths;
  }

  // Warnings that only the laid out page can find (a selector that matches nothing, a script
  // that threw) join the ones the reading found.
  function live(root, lines) {
    var box = root.querySelector('.sf-warn');
    if (box._static == null) box._static = box.textContent;
    var all = [box._static].concat(root._scriptErrors || [], lines).filter(Boolean);
    var text = all.join('\n');
    if (box.textContent !== text) box.textContent = text;
  }

  // Pointing at a region, its badge, its leader, its note, or the element it points at in the
  // drawing lights up all of them.
  function wireHover(root, fig) {
    var box = root.querySelector('.sf'), cur = null;
    function light(n) {
      if (n === cur) return;
      cur = n;
      each(root.querySelectorAll('.hl'), function (el) { el.classList.remove('hl'); });
      if (n) each(root.querySelectorAll('[data-n="' + n + '"]'), function (el) { el.classList.add('hl'); });
    }
    root.addEventListener('mouseover', function (e) {
      var t = e.target.closest ? e.target.closest('[data-n]') : null;
      if (t) return light(t.getAttribute('data-n'));
      var hit = null;
      // The innermost element an entry points at wins, so a part inside a larger region is reachable.
      (fig.found || []).forEach(function (b, i) {
        if (b && b.el && !b.sub && b.el.contains(e.target) && (!hit || hit.el.contains(b.el))) hit = { el: b.el, n: i + 1 };
      });
      light(hit ? String(hit.n) : null);
    });
    box.addEventListener('mouseleave', function () { light(null); });
  }

  // A drawing's script runs once it is in the page, with the figure's shadow root as `root`
  // and its own drawing element as `drawing`.
  function runScripts(root, fig) {
    root._scriptErrors = [];
    fig.scripts.forEach(function (s) {
      var d = root.querySelector('.sf-drawing[data-d="' + s.id + '"]');
      try { new Function('root', 'drawing', s.code).call(d, root, d); }
      catch (e) { root._scriptErrors.push('script: ' + (e && e.message || e)); }
    });
  }

  function mount(host, fig) {
    var root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    var style = document.getElementById('annotated-style');
    root.innerHTML = (style ? style.innerHTML : '') + '<style>' + ICON_CSS + '</style>' + fig.markup;
    runScripts(root, fig);
    wireHover(root, fig);
    var stage = root.querySelector('.sf-stage');
    if (!stage) { live(root, []); return; }
    var queued = false;
    function again() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; layout(root, fig); });
    }
    var d = root.querySelector('.sf-drawing');
    var ro = new ResizeObserver(again);
    ro.observe(host); ro.observe(root.querySelector('.sf-device')); ro.observe(d);
    // A drawing that changes itself (a script, a click) moves what the notes point at.
    new MutationObserver(again).observe(d, { subtree: true, childList: true, attributes: true, characterData: true });
    d.addEventListener('scroll', again, true);
    d.addEventListener('load', again, true);
    host._relayout = again;
    layout(root, fig);
  }

  // ---------------------------------------------------------------- pick
  // A drag over the drawing hands back an at: line for it: relative to the nearest element
  // with an id when the drag starts on one, otherwise to the drawing. A click without a drag
  // hands back that element alone.
  function selectorOf(el, d) {
    var parts = [];
    while (el && el !== d) {
      if (el.id) { parts.unshift('#' + el.id); return parts.join(' > '); }
      var k = 1, s = el;
      while ((s = s.previousElementSibling)) if (s.localName === el.localName) k++;
      parts.unshift(el.localName + ':nth-of-type(' + k + ')');
      el = el.parentElement;
    }
    return parts.length ? ':scope > ' + parts.join(' > ') : '';
  }

  function pick(host, on, done) {
    var root = host.shadowRoot, device = root && root.querySelector('.sf-device');
    if (!device) return;
    var layer = root.querySelector('.sf-pick');
    if (!on) { if (layer) layer.remove(); return; }
    if (layer) return;
    layer = document.createElement('div');
    layer.className = 'sf-pick';
    device.appendChild(layer);
    var d = root.querySelector('.sf-drawing'), start = null, rect = null, label = null;
    function point(e) {
      var r = device.getBoundingClientRect(), s = r.width / device.offsetWidth || 1;
      return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s, cx: e.clientX, cy: e.clientY };
    }
    layer.addEventListener('mousedown', function (e) {
      e.preventDefault(); e.stopPropagation();
      start = point(e);
      rect = document.createElement('i'); label = document.createElement('b');
      layer.appendChild(rect); layer.appendChild(label);
    });
    layer.addEventListener('mousemove', function (e) {
      if (!start) return;
      var p = point(e);
      var x = Math.min(start.x, p.x), y = Math.min(start.y, p.y), w = Math.abs(p.x - start.x), h = Math.abs(p.y - start.y);
      rect.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
      label.style.cssText = 'left:' + x + 'px;top:' + (y + h + 4) + 'px';
      label.textContent = Math.round(w) + ' x ' + Math.round(h);
    });
    window.addEventListener('mouseup', function up(e) {
      if (!start || !root.contains(layer)) { window.removeEventListener('mouseup', up); return; }
      var p = point(e), s0 = start;
      start = null; rect.remove(); label.remove();
      layer.style.pointerEvents = 'none';
      var under = root.elementFromPoint(s0.cx, s0.cy);
      layer.style.pointerEvents = '';
      if (!under || !d.contains(under)) under = d;
      var anchor = under;
      while (anchor !== d && !anchor.id) anchor = anchor.parentElement;
      var w = Math.abs(p.x - s0.x), h = Math.abs(p.y - s0.y);
      var line;
      if (w < 4 && h < 4) line = 'at: ' + (selectorOf(under, d) || '0, 0, ' + Math.round(d.offsetWidth) + ', ' + Math.round(d.offsetHeight));
      else {
        var r = device.getBoundingClientRect(), sc = r.width / device.offsetWidth || 1, ar = anchor.getBoundingClientRect();
        var ox = (ar.left - r.left) / sc, oy = (ar.top - r.top) / sc;
        var box = [Math.min(s0.x, p.x) - ox, Math.min(s0.y, p.y) - oy, w, h].map(Math.round).join(', ');
        line = 'at: ' + (anchor === d ? '' : '#' + anchor.id + ' ') + box;
      }
      done(line);
    });
  }

  // ---------------------------------------------------------------- export
  // The shell tokens the annotations read. Outside the page nothing defines them, so the
  // values at this moment are written onto the exported root.
  var TOKENS = ['--bg', '--bg-soft', '--fg', '--fg-mute', '--fg-faint', '--line', '--line-strong',
    '--accent', '--accent-ink', '--accent-soft', '--danger', '--danger-soft', '--code-bg',
    '--radius-sm', '--radius-md', '--radius-lg', '--mono', '--sans'];
  var PAD = 24;

  // The figure as a standalone SVG: the rendered root inside a foreignObject, with its
  // stylesheets and the token values it was drawn with. part 'screen' takes the drawing in
  // its frame screen alone, which is what a design capture shows.
  function toSvg(host, part) {
    var root = host.shadowRoot, box = root && root.querySelector('.sf');
    if (!box || !box.offsetWidth) return null;
    var screen = part === 'screen' ? root.querySelector('.sf-screen') : null;
    var source = screen || box, pad = screen ? 0 : PAD;
    var w = Math.ceil(source.offsetWidth) + pad * 2, h = Math.ceil(source.offsetHeight) + pad * 2;
    var cs = getComputedStyle(host);
    var vars = TOKENS.map(function (t) { return t + ':' + cs.getPropertyValue(t).trim(); }).join(';');
    // Canvases are copied as pixels. The clone of a canvas is blank.
    var live = Array.prototype.slice.call(source.querySelectorAll('canvas'));
    var clone = source.cloneNode(true);
    Array.prototype.slice.call(clone.querySelectorAll('canvas')).forEach(function (c, i) {
      var img = document.createElement('img');
      try { img.src = live[i].toDataURL(); } catch (e) { }
      img.style.cssText = 'width:' + live[i].offsetWidth + 'px;height:' + live[i].offsetHeight + 'px;display:block';
      img.className = c.className;
      c.replaceWith(img);
    });
    each(clone.querySelectorAll('.sf-pick, script'), function (el) { el.remove(); });
    each(clone.querySelectorAll('*'), function (el) {
      el.classList.remove('hl');
      // HTML takes attribute names XML does not (`@click`, `:class`), and one of them makes the SVG unreadable.
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        if (!/^[A-Za-z_][\w.-]*$/.test(a.name)) el.removeAttribute(a.name);
      });
    });
    // A comment holding `--` is not XML either, and comments draw nothing.
    var walker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT), dead = [];
    while (walker.nextNode()) dead.push(walker.currentNode);
    dead.forEach(function (n) { n.remove(); });
    if (screen) {
      var wrap = document.createElement('div');
      wrap.className = 'sf';
      wrap.setAttribute('data-preset', box.getAttribute('data-preset'));
      wrap.appendChild(clone);
      clone = wrap;
      clone.style.borderRadius = '0';
    }
    var css = Array.prototype.map.call(root.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n').replace(/]]>/g, ']] >');
    var body = new XMLSerializer().serializeToString(clone);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<foreignObject x="0" y="0" width="' + w + '" height="' + h + '">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" style="' + esc(vars) + ';box-sizing:border-box;width:' + w + 'px;height:' + h + 'px;padding:' + pad + 'px;background:var(--bg-soft)">' +
      '<style><![CDATA[' + css + ']]></style>' + body + '</div></foreignObject></svg>';
    return { svg: svg, w: w, h: h };
  }

  function svgToPng(s, scale) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = s.w * scale; c.height = s.h * scale;
        var g = c.getContext('2d');
        g.scale(scale, scale);
        g.drawImage(img, 0, 0);
        try { resolve(c.toDataURL('image/png')); } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('the SVG did not load as an image')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg);
    });
  }

  // The SVG rasterised at twice its size, as a data URL.
  function toPng(host, part) {
    var s = toSvg(host, part);
    return s ? svgToPng(s, 2) : Promise.reject(new Error('not drawn yet'));
  }

  return { draw: draw, mount: mount, pick: pick, toSvg: toSvg, toPng: toPng, svgToPng: svgToPng,
    presets: PRESETS, icons: Object.keys(ICONS) };
})();
