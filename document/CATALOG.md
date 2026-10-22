---
title: ui classes
kicker: analysis-doc catalog
subtitle: every ui-* class and icon a drawing can use
slug: analysis-doc-catalog
---

# ui classes

Every class a drawing in ```annotated or ```cards can use, drawn in the preset this document was baked with. `open-package catalog <out.html> [--ui-theme <preset>]` bakes it in any preset. Open the source (`<>`) on a figure to copy its markup.

The classes only set values the preset owns: colours, type, radii, spacing. Anything else a drawing needs it writes in its own `<style>`, and it can read the preset there as `var(--ui-accent)`, `var(--ui-fg)`, `var(--ui-pad)` and the rest.

## A screen, by class

```annotated a screen built from the classes
frame: phone
html:
  <nav class="ui-nav" id="nav"><i class="ui-icon back"></i><b>주문 상세</b><span><i class="ui-icon share"></i><i class="ui-icon more"></i></span></nav>
  <div class="ui-tabs" id="tabs"><span class="on">상세</span><span>배송</span><span>문의</span></div>
  <div class="ui-stack" id="stack">
    <div class="ui-notice" id="notice"><i class="ui-icon info"></i><div><small>배송 지연</small>10월 23일에 도착해요.</div><a>자세히<i class="ui-icon chevron s"></i></a></div>
    <div class="ui-card" id="card">
      <div class="ui-row" id="row"><span class="ui-text s sub">주문번호 2026-1022-0001</span><i class="ui-icon copy s ui-faint"></i><span class="ui-space"></span><span class="ui-badge">결제 완료</span></div>
      <div class="ui-text xl">48,000원</div>
    </div>
  </div>
  <div class="ui-divider thick" id="divider"></div>
  <div class="ui-stack">
    <div class="ui-item" id="item"><span class="ui-lead"><i class="ui-icon gift"></i></span><div class="ui-body"><b>무선 이어폰 케이스</b><small>블랙 · 1개</small></div><div class="ui-end"><b>32,000원</b><small>무료 배송</small></div><i class="ui-icon chevron"></i></div>
  </div>
  <div class="ui-stack ui-bottom" id="bottom"><div class="ui-buttons"><button class="ui-button gray">배송 조회</button><button class="ui-button">문의하기</button></div></div>
  <div class="ui-tabbar" id="tabbar"><span class="on"><i class="ui-icon home"></i>홈</span><span><i class="ui-icon gift"></i>혜택</span><span><i class="ui-icon card"></i>결제</span><span><i class="ui-icon menu"></i>전체</span></div>
- ui-nav
  at: #nav
  note: icons on the left, `<b>` the title, a `<span>` of icons on the right
- ui-tabs
  at: #tabs
  note: children are the tabs, `.on` the selected one. `.fill` spreads them evenly
- ui-stack
  at: #stack
  note: a column of rows with the screen's side padding. Lists, tabs and thick dividers inside it still reach the edges
- ui-notice
  at: #notice
  note: icon, a `<div>` with an optional `<small>` kicker, an optional `<a>` action. `.danger` `.gray`
- ui-card
  at: #card
  note: a rounded surface. Rows inside it have no side padding of their own
- ui-row, ui-space, ui-badge
  at: #row
  note: a row left to right. `ui-space` pushes what follows to the far end
- ui-divider thick
  at: #divider
  note: the band between sections. Without `.thick` a hairline
- ui-item
  at: #item
  note: `ui-lead`, `ui-body` (`<b>` title, `<small>` sub), `ui-end`, then a trail (an icon, `ui-toggle`, `ui-check`)
- ui-bottom, ui-buttons
  at: #bottom
  note: `ui-bottom` sits at the bottom of the screen. Buttons in `ui-buttons` share the width
- ui-tabbar
  at: #tabbar
  note: children are icon and label. `.on` the current tab
```

## Every class

```cards the classes
- text
  note: any element. Size, weight, tone and alignment combine
  html:
    <div class="ui-stack">
      <div class="ui-text xxl">xxl 28</div><div class="ui-text xl">xl 24</div><div class="ui-text l">l 20</div>
      <div class="ui-text m">m 17</div><div class="ui-text">body 15</div><div class="ui-text s sub">s 14 sub</div><div class="ui-text xs faint">xs 12 faint</div>
      <div class="ui-row"><span class="ui-text accent semibold">accent</span><span class="ui-text danger">danger</span><span class="ui-text positive">positive</span></div>
    </div>
  field: ui-text | class | the base
  field: xxl xl l m s xs | size | xxl, xl and l are bold unless a weight says otherwise
  field: bold semibold regular | weight |
  field: sub faint accent danger positive | tone | also `ui-sub` `ui-faint` `ui-accent` on any element
  field: center right | align |
- button
  note: `<button>` or any element
  html:
    <div class="ui-stack">
      <div class="ui-buttons"><button class="ui-button">primary</button><button class="ui-button secondary">secondary</button></div>
      <div class="ui-buttons"><button class="ui-button gray">gray</button><button class="ui-button danger">danger</button></div>
      <div class="ui-row"><button class="ui-button small">small</button><button class="ui-button small gray">small gray</button><button class="ui-button text">text</button><button class="ui-button small disabled">disabled</button></div>
    </div>
  field: ui-button | class | primary unless a style says otherwise
  field: secondary gray text danger | style |
  field: small disabled | option | small hugs its label
  field: ui-buttons | parent | buttons share its width
- chip and badge
  html:
    <div class="ui-stack">
      <div class="ui-row wrap"><span class="ui-chip on">1개월</span><span class="ui-chip">3개월</span><span class="ui-chip">6개월</span><span class="ui-chip">1년</span></div>
      <div class="ui-row"><span class="ui-badge">accent</span><span class="ui-badge danger">danger</span><span class="ui-badge gray">gray</span><span class="ui-badge solid">NEW</span></div>
    </div>
  field: ui-chip | class | `.on` selected
  field: ui-badge | class | `.danger` `.gray` `.solid`
  field: ui-row wrap | parent | chips wrap onto the next line
- list row
  html:
    <div class="ui-item"><span class="ui-lead">토</span><div class="ui-body"><b>토스뱅크 통장</b><small>1000-1234-5678</small></div><span class="ui-toggle on"></span></div>
    <div class="ui-item"><span class="ui-lead"><i class="ui-icon bank"></i></span><div class="ui-body"><b>받는 계좌</b></div><div class="ui-end"><b>10,000원</b><small>수수료 0원</small></div></div>
    <div class="ui-item"><div class="ui-body"><b>자동 이체</b><small>매달 25일</small></div><span class="ui-check on"></span></div>
  field: ui-item | class | a row, edge to edge
  field: ui-lead | child | an icon, or a letter for a brand
  field: ui-body | child | `<b>` title and `<small>` sub
  field: ui-end | child | the right column
  field: ui-toggle ui-check | trail | `.on` set
- notice
  html:
    <div class="ui-stack">
      <div class="ui-notice"><i class="ui-icon info"></i><div>10월 23일에 도착해요.</div><a>자세히<i class="ui-icon chevron s"></i></a></div>
      <div class="ui-notice danger"><i class="ui-icon alert"></i><div><small>결제 실패</small>카드 한도를 확인해주세요.</div></div>
      <div class="ui-notice gray"><i class="ui-icon clock"></i><div>점검 중이에요.</div></div>
    </div>
  field: ui-notice | class | `.danger` `.gray`
  field: small | child | the kicker
  field: a | child | the action
- surfaces
  html:
    <div class="ui-stack"><div class="ui-card"><div class="ui-text s sub">ui-card</div><div class="ui-text l">48,000원</div></div></div>
    <div class="ui-section"><div class="ui-stack"><div class="ui-text s sub">ui-section</div><div class="ui-text">a band in the section colour</div></div></div>
  field: ui-card | class | rows inside it have no side padding
  field: ui-section | class | a full width band
  field: ui-stack | class | a column with the side padding
- bottom sheet
  note: `ui-overlay` dims the screen and holds the sheet at the bottom
  html:
    <div class="ui-overlay"><div class="ui-sheet"><div class="ui-stack"><div class="ui-text l">주문을 취소할까요?</div><div class="ui-text sub">결제한 48,000원은 3일 안에 돌려드려요.</div><div class="ui-buttons"><button class="ui-button gray">닫기</button><button class="ui-button danger">취소하기</button></div></div></div></div>
  field: ui-overlay | class | covers the whole screen
  field: ui-sheet | class | rounded top, handle
- field and image
  html:
    <div class="ui-stack">
      <div class="ui-input"><label>보낼 금액</label><div class="ui-field empty">금액을 입력해주세요</div></div>
      <div class="ui-input"><div class="ui-field">10,000원</div></div>
      <div class="ui-image">배너 이미지</div>
    </div>
  field: ui-input | class | `<label>` and a `ui-field`
  field: ui-field | class | `.empty` for a placeholder
  field: ui-image | class | a placeholder. Set `aspect-ratio` or a height in style. `.bleed` edge to edge
- icons
  note: `<i class="ui-icon name">`. `.s` 18, `.l` 32. They take the colour of the text
  html:
    <style>.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 6px; padding: 4px var(--ui-pad) } .grid div { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--ui-sub) } .grid i { color: var(--ui-fg) }</style>
    <div class="grid" id="icons"></div>
    <script>
      drawing.querySelector('#icons').innerHTML = Annotated.icons.map(n => '<div><i class="ui-icon ' + n + '"></i>' + n + '</div>').join('');
    </script>
```
