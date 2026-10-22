/* analysis-doc screen figures. ```screen draws an app screen with numbered regions and the
 * note cards beside it, ```cards draws components side by side with their fields.
 * In: the text of the block. Out: markup for a shadow root (draw), then the root itself
 * with layout and hover wired (mount). The shadow root is what keeps the shell's CSS out of
 * the app screen and the app screen's CSS out of the shell.
 */
window.ScreenFigure = (function () {
  'use strict';

  var PRESETS = ['default', 'ios', 'material', 'toss'];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function trim(s) { return String(s).trim(); }

  // ---------------------------------------------------------------- icons
  // 24 unit boxes, stroked in currentColor so a primitive's tone colours them.
  var ICONS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    down: '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
    share: '<path d="M12 3.5v11M7.5 8L12 3.5 16.5 8M5 12.5v6.5a1 1 0 001 1h12a1 1 0 001-1v-6.5"/>',
    more: '<circle class="fill" cx="5.5" cy="12" r="1.7"/><circle class="fill" cx="12" cy="12" r="1.7"/><circle class="fill" cx="18.5" cy="12" r="1.7"/>',
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
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle class="fill" cx="12" cy="7.8" r="1.2"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5"/><circle class="fill" cx="12" cy="17.3" r="1.1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.4 2.4 0 114 1.8c-.9.7-1.6 1.2-1.6 2.6"/><circle class="fill" cx="12" cy="17" r="1.1"/>',
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
    wallet: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 9.5h13a1 1 0 011 1v1"/><circle class="fill" cx="16" cy="13.5" r="1.2"/>',
    chat: '<path d="M5 5h14v10H9.5L5 19z"/>',
    pin: '<path d="M12 21s-6-6.2-6-11a6 6 0 0112 0c0 4.8-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5z"/>',
    external: '<path d="M10 5H6a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-4M14 4.5h5.5V10M19.5 4.5L11 13"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>'
  };
  function icon(name) {
    var body = ICONS[String(name).toLowerCase()];
    return body ? '<svg class="sf-icon" viewBox="0 0 24 24">' + body + '</svg>' : '';
  }
  function isIcon(name) { return !!ICONS[String(name).toLowerCase()]; }

  // The phone's own chrome. Not an icon a document picks, so not in ICONS.
  var STATUS = '<div class="sf-status"><b>9:41</b><i></i><span>' +
    '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>' +
    '<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.6c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.6 10.6 0 008 .8 10.6 10.6 0 00.5 3.8l1.3 1.3A8.7 8.7 0 018 2.6zm0 3.6c1.4 0 2.7.5 3.7 1.5L13 6.4a7 7 0 00-10 0l1.3 1.3c1-1 2.3-1.5 3.7-1.5zm0 3.5a1.6 1.6 0 00-1.2.5L8 11.5l1.2-1.3A1.6 1.6 0 008 9.7z"/></svg>' +
    '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.5"/><path d="M25 4.5v4a2 2 0 000-4z" opacity=".45"/></svg>' +
    '</span></div>';

  // ---------------------------------------------------------------- reading the block
  // Indentation makes the tree: an entry (`- name`), its keys (`ui:`, `note:`, ...), and
  // the rows under a container. Only depth relative to the parent matters.
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

  // Splits on `sep` where it stands outside quotes and parentheses.
  function splitTop(s, sep) {
    var out = [], depth = 0, quoted = false, cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (quoted) {
        cur += ch;
        if (ch === '\\' && i + 1 < s.length) cur += s[++i];
        else if (ch === '"') quoted = false;
        continue;
      }
      if (ch === '"') quoted = true;
      else if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(trim).filter(Boolean);
  }

  function unquote(s) {
    s = trim(s);
    return /^".*"$/.test(s) ? s.slice(1, -1).replace(/\\(.)/g, '$1') : s;
  }

  // `kind(arg, arg, ...)`. An argument is a quoted text, a `key: value`, or a bare word (a flag).
  var CALL_RE = /^([a-z]+)\s*(?:\(([\s\S]*)\))?$/i;
  var KEY_RE = /^([a-z][\w-]*)\s*:\s*([\s\S]+)$/i;
  function parseCall(s) {
    var m = trim(s).match(CALL_RE);
    if (!m) return { kind: '', source: s, texts: [], keys: {}, flags: [] };
    var call = { kind: m[1].toLowerCase(), source: s, texts: [], keys: {}, flags: [] };
    splitTop(m[2] || '', ',').forEach(function (arg) {
      var km = arg[0] === '"' ? null : arg.match(KEY_RE);
      if (km) call.keys[km[1].toLowerCase()] = unquote(km[2]);
      else if (arg[0] === '"') call.texts.push(unquote(arg));
      else call.flags.push(arg);
    });
    return call;
  }

  var ENTRY_RE = /^-\s+(.*?)(?:\s+\[(planned)\])?\s*$/i;
  var LINE_KEY_RE = /^([a-z]+)\s*:\s*(.*)$/i;

  // Lines before the first entry that set something for the whole figure.
  var FIGURE_KEYS = { screen: { frame: 1 }, cards: {} };
  // Lines an entry takes, by figure.
  var ENTRY_KEYS = { screen: { ui: 1, note: 1, html: 1 }, cards: { ui: 1, note: 1, html: 1, field: 1 } };

  function parse(kind, src, warn) {
    var lines = String(src).split('\n'), opts = {}, entries = [];
    outline(lines).forEach(function (n) {
      var em = n.text.match(ENTRY_RE);
      if (em) { entries.push(parseEntry(kind, em[1], !!em[2], n.children, lines, warn)); return; }
      var km = n.text.match(LINE_KEY_RE);
      if (km && FIGURE_KEYS[kind][km[1].toLowerCase()] && !entries.length) { opts[km[1].toLowerCase()] = trim(km[2]); return; }
      warn('not read: ' + n.text);
    });
    return { opts: opts, entries: entries };
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

  function parseEntry(kind, name, planned, children, lines, warn) {
    var e = { name: name, planned: planned, ui: [], notes: [], fields: [], html: null };
    children.forEach(function (c) {
      var km = c.text.match(LINE_KEY_RE);
      var key = km ? km[1].toLowerCase() : '', value = km ? trim(km[2]) : '';
      if (!ENTRY_KEYS[kind][key]) warn(name + ': not read: ' + c.text);
      else if (key === 'ui') e.ui = e.ui.concat(value ? [{ text: value, children: c.children }] : c.children);
      else if (key === 'note') e.notes.push(value);
      else if (key === 'field') e.fields.push(splitField(value));
      else e.html = (value ? value + '\n' : '') + rawLines(c.children, lines);
    });
    return e;
  }

  // ---------------------------------------------------------------- primitives
  var TEXT_FLAGS = { xxl: 1, xl: 1, l: 1, m: 1, s: 1, xs: 1, bold: 1, semibold: 1, regular: 1,
    sub: 1, faint: 1, accent: 1, danger: 1, positive: 1, center: 1, right: 1 };
  var BUTTON_FLAGS = { primary: 1, secondary: 1, gray: 1, text: 1, danger: 1, small: 1, disabled: 1 };
  var BADGE_FLAGS = { accent: 1, danger: 1, gray: 1, solid: 1 };
  var ICON_TONES = { sub: 'var(--ui-sub)', faint: 'var(--ui-faint)', accent: 'var(--ui-accent)',
    danger: 'var(--ui-danger)', positive: 'var(--ui-positive)', fg: 'var(--ui-fg)' };
  var TRAILS = { chevron: 1, toggle: 1, check: 1, on: 1 };

  function flagClasses(call, allowed, ctx) {
    return call.flags.filter(function (f) {
      var ok = allowed[f.toLowerCase()];
      if (!ok) ctx.warn(call.kind + ': unknown option "' + f + '"');
      return ok;
    }).map(function (f) { return ' ' + f.toLowerCase(); }).join('');
  }
  function has(call, flag) { return call.flags.some(function (f) { return f.toLowerCase() === flag; }); }
  // Warns about every flag outside `allowed` (a set, or a test).
  function only(call, allowed, ctx) {
    call.flags.forEach(function (f) {
      var k = f.toLowerCase();
      if (!(typeof allowed === 'function' ? allowed(k) : allowed[k])) ctx.warn(call.kind + ': unknown option "' + f + '"');
    });
  }
  function iconOrWarn(name, ctx, who) {
    var svg = icon(name);
    if (!svg) ctx.warn(who + ': unknown icon "' + name + '"');
    return svg;
  }

  // A leading mark: an icon when the word names one, otherwise its first letter, which is
  // how a bank or brand logo reads at this size.
  function lead(word) {
    return isIcon(word) ? icon(word) : esc(String(word).charAt(0));
  }

  var KINDS = {
    nav: function (c, ctx) {
      var left = '', right = '';
      c.flags.forEach(function (f) {
        var k = f.toLowerCase();
        if (!left && (k === 'back' || k === 'close')) left = '<span class="tap">' + icon(k) + '</span>';
        else right += '<span class="tap">' + iconOrWarn(k, ctx, 'nav') + '</span>';
      });
      if (c.keys.action) right += '<span class="tap action">' + esc(c.keys.action) + '</span>';
      var title = c.texts[0] || c.keys.title || '';
      return '<div class="sf-nav"><div class="side">' + left + '</div>' +
        (title ? '<div class="title">' + esc(title) + '</div>' : '') +
        '<div class="side end">' + right + '</div></div>';
    },
    text: function (c, ctx) {
      return '<div class="sf-t' + flagClasses(c, TEXT_FLAGS, ctx) + '">' + esc(c.texts.join(' ')) + '</div>';
    },
    button: function (c, ctx) {
      return '<div class="sf-btn' + flagClasses(c, BUTTON_FLAGS, ctx) + '">' + esc(c.texts[0] || '') + '</div>';
    },
    chip: function (c, ctx) {
      only(c, { on: 1 }, ctx);
      return '<span class="sf-chip' + (has(c, 'on') ? ' on' : '') + '">' + esc(c.texts[0] || '') + '</span>';
    },
    badge: function (c, ctx) {
      return '<span class="sf-badge-ui' + flagClasses(c, BADGE_FLAGS, ctx) + '">' + esc(c.texts[0] || '') + '</span>';
    },
    item: function (c, ctx) {
      var t = c.texts, k = c.keys;
      var leads = c.flags.filter(function (f) { return !TRAILS[f.toLowerCase()]; });
      leads.slice(1).forEach(function (f) { ctx.warn('item: unknown option "' + f + '"'); });
      var title = k.title || t[0] || '', sub = k.sub || t[1] || '';
      var right = k.right || t[2] || '', rightSub = k['right-sub'] || t[3] || '';
      var leadWord = leads[0];
      var on = has(c, 'on'), trail = '';
      if (has(c, 'chevron')) trail = '<span class="trail">' + icon('chevron') + '</span>';
      else if (has(c, 'toggle')) trail = '<span class="sf-toggle' + (on ? ' on' : '') + '"></span>';
      else if (has(c, 'check')) trail = '<span class="sf-check' + (on ? ' on' : '') + '">' + icon('check') + '</span>';
      return '<div class="sf-item">' +
        (leadWord ? '<span class="lead">' + lead(leadWord) + '</span>' : '') +
        '<div class="body"><div class="title">' + esc(title) + '</div>' + (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>' +
        (right || rightSub ? '<div class="end">' + (right ? '<div class="title">' + esc(right) + '</div>' : '') +
          (rightSub ? '<div class="sub">' + esc(rightSub) + '</div>' : '') + '</div>' : '') +
        trail + '</div>';
    },
    notice: function (c, ctx) {
      only(c, function (k) { return k === 'danger' || k === 'gray' || isIcon(k); }, ctx);
      var kicker = c.keys.kicker || (c.texts.length > 1 ? c.texts[0] : '');
      var text = c.keys.text || c.texts[c.texts.length > 1 ? 1 : 0] || '';
      var tone = has(c, 'danger') ? ' danger' : has(c, 'gray') ? ' gray' : '';
      var mark = c.flags.filter(isIcon)[0] || (tone === ' danger' ? 'alert' : 'info');
      return '<div class="sf-notice' + tone + '"><span class="lead">' + icon(mark) + '</span>' +
        '<div class="body">' + (kicker ? '<div class="kicker">' + esc(kicker) + '</div>' : '') +
        '<div class="text">' + esc(text) + '</div></div>' +
        (c.keys.action ? '<span class="action">' + esc(c.keys.action) + icon('chevron') + '</span>' : '') + '</div>';
    },
    tabs: function (c, ctx) {
      only(c, { fill: 1 }, ctx);
      var on = c.keys.on || c.texts[0];
      return '<div class="sf-tabs' + (has(c, 'fill') ? ' fill' : '') + '">' + c.texts.map(function (t) {
        return '<span' + (t === on ? ' class="on"' : '') + '>' + esc(t) + '</span>';
      }).join('') + '</div>';
    },
    input: function (c) {
      var value = c.keys.value || '', hint = c.texts[0] || '';
      return '<div class="sf-input">' + (c.keys.label ? '<div class="label">' + esc(c.keys.label) + '</div>' : '') +
        '<div class="field' + (value ? '' : ' empty') + '">' + esc(value || hint) + '</div></div>';
    },
    icon: function (c, ctx) {
      var tone = '', size = '';
      var marks = c.flags.filter(function (f) {
        var k = f.toLowerCase();
        if (ICON_TONES[k]) { tone = ICON_TONES[k]; return false; }
        if (k === 's') { size = ' s'; return false; }
        return true;
      });
      return marks.map(function (f) {
        return '<span class="sf-glyph' + size + '"' + (tone ? ' style="color:' + tone + '"' : '') + '>' + iconOrWarn(f, ctx, 'icon') + '</span>';
      }).join('');
    },
    image: function (c, ctx) {
      only(c, { bleed: 1 }, ctx);
      var ratio = (c.keys.ratio || '16:9').split(':').map(Number);
      var h = c.keys.height ? Number(c.keys.height) : 0;
      var shape = h ? 'height:' + h + 'px' : 'aspect-ratio:' + (ratio[0] || 16) + '/' + (ratio[1] || 9);
      return '<div class="sf-image' + (has(c, 'bleed') ? ' bleed' : '') + '" style="' + shape + '">' + icon('image') +
        (c.texts[0] ? '<span>' + esc(c.texts[0]) + '</span>' : '') + '</div>';
    },
    divider: function (c, ctx) {
      only(c, { thick: 1 }, ctx);
      return '<div class="sf-divider' + (has(c, 'thick') ? ' thick' : '') + '"></div>';
    },
    space: function (c) {
      var n = Number(c.flags[0]);
      return n ? '<div class="sf-space" style="height:' + n + 'px;flex:none"></div>' : '<div class="sf-space grow"></div>';
    },
    tabbar: function (c, ctx) {
      var on = c.keys.on;
      return '<div class="sf-tabbar">' + Object.keys(c.keys).filter(function (k) { return k !== 'on'; }).map(function (k) {
        var label = c.keys[k];
        return '<span' + (label === on ? ' class="on"' : '') + '>' + iconOrWarn(k, ctx, 'tabbar') + esc(label) + '</span>';
      }).join('') + '</div>';
    }
  };

  // Elements that span the screen edge to edge and pad their own content.
  var BLEED = { nav: 1, tabs: 1, tabbar: 1, divider: 1, item: 1 };
  var CONTAINERS = { card: 1, section: 1, sheet: 1 };

  function element(call, ctx) {
    var make = KINDS[call.kind];
    if (!make) {
      ctx.warn('unknown element: ' + call.source);
      return '<div class="sf-unknown">' + esc(call.source) + '</div>';
    }
    return make(call, ctx);
  }

  // Each node is a container (card, section, sheet) holding rows, or one row of elements
  // separated by `|`.
  function rows(nodes, ctx) {
    return nodes.map(function (n) {
      var word = n.text.toLowerCase();
      if (CONTAINERS[word]) {
        return { bleed: true, sheet: word === 'sheet',
          html: '<div class="sf-' + word + '"><div class="sf-rows">' + rows(n.children, ctx).map(html).join('') + '</div></div>' };
      }
      if (n.children.length) ctx.warn('only card, section and sheet hold rows: ' + n.text);
      var calls = splitTop(n.text, '|').map(parseCall);
      var bleed = calls.length === 1 && (BLEED[calls[0].kind] || (calls[0].kind === 'image' && has(calls[0], 'bleed')));
      var wrap = calls.every(function (c) { return c.kind === 'chip' || c.kind === 'badge'; });
      return { bleed: !!bleed,
        html: '<div class="sf-row' + (bleed ? ' bleed' : '') + (wrap ? ' wrap' : '') + '">' +
          calls.map(function (c) { return element(c, ctx); }).join('') + '</div>' };
    });
  }
  function html(r) { return r.html; }

  // ---------------------------------------------------------------- raw regions
  // A region may be written in HTML where the primitives fall short. Its <style> is rewritten
  // so every selector starts at that region, which keeps it off the primitives and off other
  // raw regions in the same root.
  function scopeCss(css, scope) {
    var sheet;
    try { sheet = new CSSStyleSheet(); sheet.replaceSync(css); } catch (e) { return ''; }
    function walk(list) {
      return Array.prototype.map.call(list, function (rule) {
        if (rule.selectorText != null && rule.style) {
          var want = splitTop(rule.selectorText, ',').map(function (sel) {
            return /^(:root|html|body)(?![\w(-])/.test(sel) ? sel.replace(/^(:root|html|body)/, scope) : scope + ' ' + sel;
          });
          rule.selectorText = want.join(', ');
          // The browser keeps the old selector when the new one does not parse, and the old
          // one is unscoped, so a rule that did not take is dropped.
          var took = splitTop(rule.selectorText, ',').every(function (sel) { return sel.indexOf(scope) === 0; });
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

  function raw(source, ctx) {
    var t = document.createElement('template');
    t.innerHTML = source;
    var css = '';
    Array.prototype.slice.call(t.content.querySelectorAll('style, script')).forEach(function (el) {
      if (el.localName === 'style') css += el.textContent + '\n';
      el.remove();
    });
    var id = ctx.raw++;
    var scope = '.sf-raw[data-raw="' + id + '"]';
    return '<div class="sf-raw" data-raw="' + id + '">' + (css ? '<style>' + scopeCss(css, scope) + '</style>' : '') + t.innerHTML + '</div>';
  }

  // ---------------------------------------------------------------- figures
  function tag(planned) { return planned ? '<span class="sf-tag">planned</span>' : ''; }

  function region(e, n, ctx) {
    var rs = rows(e.ui, ctx);
    var sheet = rs.length === 1 && rs[0].sheet;
    var flush = rs.length && e.html == null && rs.every(function (r) { return r.bleed; });
    // A tab bar belongs to the bottom of the screen whatever stands above it.
    var bottom = e.ui.length === 1 && /^tabbar\b/i.test(e.ui[0].text);
    return { sheet: sheet, html: '<section class="sf-region' + (flush ? ' flush' : '') + (sheet ? ' sheet-region' : '') +
      (bottom ? ' bottom' : '') + '" data-n="' + n + '">' +
      rs.map(html).join('') + (e.html != null ? raw(e.html, ctx) : '') + '</section>' };
  }

  function screen(model, ctx) {
    var frame = (model.opts.frame || 'phone').toLowerCase();
    if (frame !== 'phone' && frame !== 'none') { ctx.warn('frame: "' + frame + '" is not phone or none'); frame = 'phone'; }
    var phone = frame === 'phone';
    var flow = '', sheets = '';
    model.entries.forEach(function (e, i) {
      var r = region(e, i + 1, ctx);
      if (r.sheet) sheets += r.html; else flow += r.html;
    });
    var marks = model.entries.map(function (e, i) {
      return '<div class="sf-mark' + (e.planned ? ' planned' : '') + '" data-n="' + (i + 1) + '"></div>';
    }).join('');
    var badges = model.entries.map(function (e, i) { return '<div class="sf-badge" data-n="' + (i + 1) + '">' + (i + 1) + '</div>'; }).join('');
    var notes = model.entries.map(function (e, i) {
      return '<li class="sf-note" data-n="' + (i + 1) + '"><span class="sf-num" data-n="' + (i + 1) + '">' + (i + 1) + '</span><div>' +
        '<div class="sf-note-name">' + esc(e.name) + tag(e.planned) + '</div>' +
        e.notes.map(function (l) { return '<div class="sf-note-line">' + ctx.inline(l) + '</div>'; }).join('') + '</div></li>';
    }).join('');
    return '<div class="sf-stage">' +
      '<div class="sf-device ' + (phone ? 'sf-phone' : 'sf-bare') + '"><div class="sf-screen' + (sheets ? ' has-sheet' : '') + '">' + (phone ? STATUS : '') +
        '<div class="sf-content">' + flow + '</div>' + (phone ? '<div class="sf-home"></div>' : '') +
        (sheets ? '<div class="sf-dim"></div>' + sheets : '') + '</div>' +
        '<div class="sf-marks">' + marks + '</div></div>' +
      '<svg class="sf-leaders"></svg>' + badges + '<ol class="sf-notes">' + notes + '</ol></div>';
  }

  function cards(model, ctx) {
    return '<div class="sf-cards">' + model.entries.map(function (e) {
      var rs = rows(e.ui, ctx);
      var sheet = rs.length === 1 && rs[0].sheet;
      var body = rs.map(html).join('') + (e.html != null ? raw(e.html, ctx) : '');
      return '<div class="sf-cardbox"><div class="sf-cardbox-head"><div class="sf-cardbox-name">' + esc(e.name) + tag(e.planned) + '</div>' +
        e.notes.map(function (l) { return '<div class="sf-card-note">' + ctx.inline(l) + '</div>'; }).join('') + '</div>' +
        (body ? '<div class="sf-preview' + (sheet ? ' sheet' : '') + (e.planned ? ' planned' : '') + '"><div class="sf-rows">' + body + '</div></div>' : '') +
        (e.fields.length ? '<table class="sf-fields"><thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead><tbody>' +
          e.fields.map(function (f) {
            return '<tr><td>' + esc(f[0] || '') + '</td><td class="type">' + ctx.inline(f[1] || '') + '</td><td>' + ctx.inline(f[2] || '') + '</td></tr>';
          }).join('') + '</tbody></table>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  // Markup for one figure's shadow root, without the stylesheet.
  //   kind: 'screen' | 'cards'
  //   options.inline: renders a line of inline markdown (notes, field meanings)
  //   options.preset: the document's ui-theme
  function draw(kind, src, options) {
    var warnings = [];
    var ctx = { inline: options.inline, raw: 0, warn: function (w) { warnings.push(w); } };
    var preset = options.preset || 'default';
    if (PRESETS.indexOf(preset) < 0) {
      ctx.warn('ui-theme "' + preset + '" is not a preset (' + PRESETS.join(', ') + '). drawn with default');
      preset = 'default';
    }
    var model = parse(kind, src, ctx.warn);
    var body = kind === 'cards' ? cards(model, ctx) : screen(model, ctx);
    return '<div class="sf" data-preset="' + preset + '">' +
      (warnings.length ? '<div class="sf-warn">' + warnings.map(esc).join('<br>') + '</div>' : '') + body + '</div>';
  }

  // ---------------------------------------------------------------- layout
  // Offsets rather than client rects, so an enlarged figure under a CSS transform measures
  // the same as it does in the page.
  function offsetIn(el, ancestor) {
    var x = 0, y = 0;
    while (el && el !== ancestor) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x: x, y: y };
  }

  var GUTTER = 60, NOTE_MIN = 220, BADGE_STEP = 26;

  // Marks cover the regions, badges stand outside the device at each region's middle, and
  // each note starts level with its badge unless the note above pushes it down.
  function layout(root) {
    var stage = root.querySelector('.sf-stage');
    if (!stage || !stage.clientWidth) return;
    var device = stage.querySelector('.sf-device');
    var marks = root.querySelectorAll('.sf-mark'), badges = root.querySelectorAll('.sf-badge');
    var notes = root.querySelectorAll('.sf-note'), list = root.querySelector('.sf-notes');
    var svg = root.querySelector('.sf-leaders');
    var screenEl = root.querySelector('.sf-screen');
    // A sheet lies over the screen, so the screen has to be tall enough to hold it.
    screenEl.style.minHeight = '';
    Array.prototype.forEach.call(root.querySelectorAll('.sheet-region'), function (r) {
      if (r.offsetHeight + 120 > screenEl.offsetHeight) screenEl.style.minHeight = (r.offsetHeight + 120) + 'px';
    });
    var W = stage.clientWidth, dw = device.offsetWidth;
    var stacked = W < dw + GUTTER + NOTE_MIN;
    stage.classList.toggle('stacked', stacked);
    stage.style.minHeight = '';

    var lastBadge = -Infinity, lastNote = 0, paths = '';
    var bx = stacked ? dw - 13 : dw + 28, nx = dw + GUTTER;
    if (!stacked) { list.style.left = nx + 'px'; list.style.width = (W - nx) + 'px'; }
    else { list.style.left = ''; list.style.width = ''; }

    // Regions are not in entry order in the page (a sheet comes last), so each is found by its number.
    Array.prototype.forEach.call(marks, function (m, i) {
      var r = root.querySelector('.sf-region[data-n="' + (i + 1) + '"]');
      var p = offsetIn(r, device), h = r.offsetHeight;
      m.style.left = (p.x + 3) + 'px'; m.style.width = Math.max(4, r.offsetWidth - 6) + 'px';
      m.style.top = (p.y + 1) + 'px'; m.style.height = Math.max(4, h - 2) + 'px';
      var cy = p.y + h / 2, by = Math.max(cy, lastBadge + BADGE_STEP);
      lastBadge = by;
      badges[i].style.left = bx + 'px'; badges[i].style.top = by + 'px';
      if (stacked) return;
      var note = notes[i], ny = Math.max(by - 20, lastNote);
      note.style.top = ny + 'px';
      lastNote = ny + note.offsetHeight + 8;
      var n = i + 1;
      paths += '<path data-n="' + n + '" d="M' + (dw + 4) + ' ' + cy + 'L' + (bx - 11) + ' ' + by + '"/>' +
        '<path data-n="' + n + '" d="M' + (bx + 11) + ' ' + by + 'H' + (nx - 8) + 'V' + (ny + 20) + 'H' + nx + '"/>';
    });
    if (!stacked) stage.style.minHeight = Math.max(device.offsetHeight, lastNote) + 'px';
    svg.setAttribute('width', W);
    svg.setAttribute('height', stage.offsetHeight);
    svg.innerHTML = paths;
  }

  // Pointing at a region, its badge, its leader or its note lights up all four.
  function wireHover(root) {
    var box = root.querySelector('.sf'), cur = null;
    function light(n) {
      if (n === cur) return;
      cur = n;
      Array.prototype.forEach.call(root.querySelectorAll('.hl'), function (el) { el.classList.remove('hl'); });
      if (n) Array.prototype.forEach.call(root.querySelectorAll('[data-n="' + n + '"]'), function (el) { el.classList.add('hl'); });
    }
    root.addEventListener('mouseover', function (e) {
      var t = e.target.closest ? e.target.closest('[data-n]') : null;
      light(t ? t.getAttribute('data-n') : null);
    });
    box.addEventListener('mouseleave', function () { light(null); });
  }

  function mount(host, markup) {
    var root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    var style = document.getElementById('screen-style');
    root.innerHTML = (style ? style.innerHTML : '') + markup;
    wireHover(root);
    if (root.querySelector('.sf-stage')) {
      var ro = new ResizeObserver(function () { layout(root); });
      ro.observe(host);
      ro.observe(root.querySelector('.sf-device'));
    }
  }

  // ---------------------------------------------------------------- export
  // The shell tokens the annotations read. Outside the page nothing defines them, so the
  // values at this moment are written onto the exported root.
  var TOKENS = ['--bg', '--bg-soft', '--fg', '--fg-mute', '--fg-faint', '--line', '--line-strong',
    '--accent', '--accent-ink', '--accent-soft', '--danger', '--danger-soft', '--code-bg',
    '--radius-sm', '--radius-md', '--radius-lg', '--mono', '--sans'];
  var PAD = 24;

  // The figure as a standalone SVG: the rendered root inside a foreignObject, with its
  // stylesheet and the token values it was drawn with.
  function toSvg(host) {
    var root = host.shadowRoot, box = root && root.querySelector('.sf');
    if (!box || !box.offsetWidth) return null;
    var w = Math.ceil(box.offsetWidth) + PAD * 2, h = Math.ceil(box.offsetHeight) + PAD * 2;
    var cs = getComputedStyle(host);
    var vars = TOKENS.map(function (t) { return t + ':' + cs.getPropertyValue(t).trim(); }).join(';');
    var clone = box.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('*'), function (el) {
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
    var sheet = root.querySelector('style');
    var css = (sheet ? sheet.textContent : '').replace(/]]>/g, ']] >');
    var body = new XMLSerializer().serializeToString(clone);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<foreignObject x="0" y="0" width="' + w + '" height="' + h + '">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" style="' + esc(vars) + ';box-sizing:border-box;width:' + w + 'px;height:' + h + 'px;padding:' + PAD + 'px;background:var(--bg-soft)">' +
      '<style><![CDATA[' + css + ']]></style>' + body + '</div></foreignObject></svg>';
    return { svg: svg, w: w, h: h };
  }

  // The same SVG rasterised at twice its size.
  function toPng(host) {
    var s = toSvg(host);
    if (!s) return Promise.reject(new Error('not drawn yet'));
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = s.w * 2; c.height = s.h * 2;
        var g = c.getContext('2d');
        g.scale(2, 2);
        g.drawImage(img, 0, 0);
        try {
          c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('empty image')); }, 'image/png');
        } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('the SVG did not load as an image')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg);
    });
  }

  return { draw: draw, mount: mount, toSvg: toSvg, toPng: toPng, presets: PRESETS };
})();
