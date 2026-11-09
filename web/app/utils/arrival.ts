import { MOVE_KEY } from './move.ts'

export interface ArrivalNav { to: string, tabs: string[] }

// What the page does when it is revealed after a move from another document (the arrival half of watchMoves in assets/shell.js). It runs in the <head>
// (utils/visitorScript.ts): the browser reveals a prerendered page before the scripts of the app have run, so a listener the app adds later is too late
// and the page would get the browser's own cross-fade. It is text and not a function because the build replaces `document` and `window` in the server
// code, and a function sent as text would lose them.
// The move counts when the visitor clicked the link that led here, or went back or forward; a move with no direction, or none that was kept, shows
// the page without a slide.
export const arrivalScript = (nav: ArrivalNav[], ported: { html: string, route: string }[]) => String.raw`(function (nav, ported, key) {
  var html = document.documentElement;
  function stepOf (path) {
    var section = -1, page = -1, i, j;
    for (i = 0; i < nav.length; i++) if (nav[i].to === path || nav[i].tabs.indexOf(path) >= 0) { section = i; break; }
    if (section < 0) return null;
    page = nav[section].tabs.length ? nav[section].tabs.indexOf(path) : 0;
    return page < 0 ? null : { section: section, page: page };
  }
  function directionOf (from, to) {
    var a = stepOf(from), b = stepOf(to);
    if (!a || !b || (a.section === b.section && a.page === b.page)) return null;
    if (a.section !== b.section) return b.section > a.section ? 'right' : 'left';
    var column = matchMedia('(min-width: 1024px)').matches;
    if (b.page > a.page) return column ? 'down' : 'right';
    return column ? 'up' : 'left';
  }
  function trim (path) { return path.replace(/\/$/, '') || '/'; }
  var restored = false;
  addEventListener('pageshow', function (e) { restored = e.persisted; });
  addEventListener('pagereveal', function (e) {
    var kept = null;
    try { kept = JSON.parse(sessionStorage.getItem(key)); sessionStorage.removeItem(key); } catch (err) {}
    if (kept && Date.now() - (kept.time || 0) >= 5000) kept = null;
    var transition = e.viewTransition;
    if (!transition) return;
    var traverse = (window.navigation && navigation.activation && navigation.activation.navigationType === 'traverse') || restored ||
      performance.getEntriesByType('navigation').some(function (n) { return n.type === 'back_forward'; });
    var here = trim(location.pathname), direction = null;
    if (kept) {
      var leadsHere = false;
      if (kept.nav && kept.href) {
        var url = new URL(kept.href, location.href), page = null, k;
        for (k = 0; k < ported.length; k++) if (url.pathname === '/' + ported[k].html) page = ported[k];
        leadsHere = trim(page ? page.route : url.pathname) === here && url.search === location.search;
      }
      direction = traverse || leadsHere ? directionOf(kept.from, here) : null;
    }
    if (!kept || !direction) {
      transition.ready.catch(function () {});
      transition.skipTransition();
      return;
    }
    html.dataset.vt = direction;
    var main = document.querySelector('.page-main');
    html.style.setProperty('--vt-old-y', ((kept.top || 0) - (main ? main.getBoundingClientRect().top : 0)) + 'px');
    transition.finished.finally(function () { delete html.dataset.vt; html.style.removeProperty('--vt-old-y'); });
  });
})(${JSON.stringify(nav)}, ${JSON.stringify(ported)}, ${JSON.stringify(MOVE_KEY)});`
