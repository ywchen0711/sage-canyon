// Chinese / English: ?lang=en|zh (the lobby passes it), else the last choice, else the browser language.
let lang = null;
try { lang = new URLSearchParams(location.search).get('lang'); } catch (e) { /* node */ }
if (lang !== 'en' && lang !== 'zh') { try { lang = localStorage.getItem('sc.lang'); } catch (e) { /* ignore */ } }
if (lang !== 'en' && lang !== 'zh') lang = typeof navigator !== 'undefined' && !/^zh/i.test(navigator.language || 'zh') ? 'en' : 'zh';
try { localStorage.setItem('sc.lang', lang); } catch (e) { /* ignore */ }
export const LANG = lang;
export const EN = lang === 'en';
// T(['中文', 'English']) or T('中文', 'English')
export const T = (zh, en) => (Array.isArray(zh) ? zh[EN ? 1 : 0] : EN ? en : zh);
export function setLang(l) { try { localStorage.setItem('sc.lang', l); } catch (e) { /* ignore */ } const u = new URL(location.href); u.searchParams.set('lang', l); location.href = u.toString(); }
