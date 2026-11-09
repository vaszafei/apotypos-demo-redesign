import { PREF_CHOICES, PREF_DEFAULTS } from '../stores/prefs.ts'
import { ACCOUNTS, USER_KEY } from '../stores/session.ts'
import { MOVE_KEY } from './move.ts'
import { arrivalScript, type ArrivalNav } from './arrival.ts'

// The page is prerendered for nobody in particular: Greek, paper theme, default font, icons off, signed out. This script runs in the <head>, before the
// first paint, and puts the visitor's choices on <html> the way the static shell does, so the first frame already has the right theme and font:
//   data-theme, data-font, data-icons  (?name= first, then localStorage['proto-name'], then the default; as pickPref in stores/prefs.ts)
//   data-signed-in                     (localStorage['proto-user'] is an account; hides the signed-out parts until the page knows, assets/css/ssr.css)
//   data-lang-pending                  (?lang= or localStorage['apotypos-locale'] is a language other than Greek; plugins/locale.client.ts removes it)
//   a pause                            (a move from another page is pending: the first frame waits until MOVE_HOLD ms after the navigation began)
//   pagereveal listener                (the slide into this page from another document, utils/arrival.ts)
//   class m-intro                      (the charts wait for their first view, as plugins/motion.client.ts does; not with reduced motion)
// Chrome starts the slide of a cross-document move only if the new page is not revealed too early. Measured on this page, served from localhost: a first
// frame before about 120 ms after the navigation began was aborted ("ViewTransition opt-in disabled", no slide) in most runs, and from about 150 ms
// on, never in 32 runs. The pages drawn by scripts are always later than that; a prerendered page is not. Nothing that tells the browser to wait
// (blocking="render" scripts and links, rel=expect) holds the first frame here, so a move that is pending (the same test as assets/page-move.js)
// keeps the parser busy until MOVE_HOLD. A page opened directly does not wait.
export const MOVE_HOLD = 150

export const visitorScript = (locales: string[], nav: ArrivalNav[], ported: { html: string, route: string }[]) => `(function(){
var d=document.documentElement,q=new URLSearchParams(location.search);
function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
var choices=${JSON.stringify(PREF_CHOICES)},defaults=${JSON.stringify(PREF_DEFAULTS)};
for(var n in choices){var a=q.get(n),s=get('proto-'+n);d.dataset[n]=choices[n].indexOf(a)>=0?a:choices[n].indexOf(s)>=0?s:defaults[n]}
var u=get(${JSON.stringify(USER_KEY)});if(u&&${JSON.stringify(Object.keys(ACCOUNTS))}.indexOf(u)>=0)d.dataset.signedIn='';
var l=q.get('lang')||get('apotypos-locale');if(l&&l!=='el'&&${JSON.stringify(locales)}.indexOf(l)>=0)d.dataset.langPending='';
if(!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('m-intro');
try{var m=JSON.parse(sessionStorage.getItem(${JSON.stringify(MOVE_KEY)}));
if(m&&Date.now()-m.time<5000&&(m.nav||(window.navigation&&navigation.activation&&navigation.activation.navigationType==='traverse')||(performance.getEntriesByType('navigation')[0]||{}).type==='back_forward'))while(performance.now()<${MOVE_HOLD});}catch(e){}
})();${arrivalScript(nav, ported)}`
