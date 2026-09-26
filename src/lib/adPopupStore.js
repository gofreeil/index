import { writable } from 'svelte/store';
import { ads } from './adsData.js';

// ============================================================
// הפופ-אפ בנייד — פורט מ-community (adPopupStore.ts)
// ------------------------------------------------------------
// הטור הימני (RightAdBanner) הוא דסקטופ בלבד, ולכן מפרסם ששילם לא הופיע
// בנייד בכלל. כאן הוא מקבל את מקומו: לחיצה על עסק בנייד פותחת קודם
// פרסומת לכמה שניות, ורק אחריה ממשיכה לדף העסק.
//
// מפרסמים משולמים קודם; פרסומת רשת ("יוצאים לחירות") רק אחת ל-
// NETWORK_AD_EVERY פופ-אפים. בלי מפרסמים משולמים — הרשת ממלאת את כל הסבב.
// ============================================================

/**
 * @typedef {Object} PopupAd
 * @property {string|number} id
 * @property {string} title
 * @property {string} description
 * @property {string} cta
 * @property {string} href
 * @property {boolean} [internal] דף נחיתה פנימי (/ads/<id>) — נפתח באותה לשונית
 * @property {string} image
 * @property {import('./adImageFit').AdImageFit} [imageFit]
 * @property {number} [imageScale]
 * @property {string} color
 */

const STORAGE_KEY = 'ad_popup_deck_v1';

/** כל כמה פופ-אפים מוצגת פרסומת רשת אחת; השאר — מפרסמים משולמים */
const NETWORK_AD_EVERY = 4;

/** @type {PopupAd[]} */
let paidAds = [];

/** נקרא מה-layout עם הפרסומות המאושרות שהשרת החזיר @param {PopupAd[]} list */
export function registerPaidAds(list) {
	paidAds = list.filter((a) => a.title && a.image && a.href);
}

/** @returns {PopupAd[]} */
function getNetworkAds() {
	return ads.filter((a) => a.title && a.description && a.image && a.href);
}

/**
 * Fisher-Yates shuffle
 * @template T
 * @param {T[]} arr
 */
function shuffle(arr) {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/** @typedef {{ deck: string[], pos: number }} DeckState */
/** @typedef {{ paid: DeckState, net: DeckState, count: number }} PopupState */

/** @returns {PopupState} */
function emptyState() {
	return { paid: { deck: [], pos: 0 }, net: { deck: [], pos: 0 }, count: 0 };
}

/** @returns {PopupState} */
function loadState() {
	if (typeof window === 'undefined') return emptyState();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const s = JSON.parse(raw);
			if (Array.isArray(s?.paid?.deck) && Array.isArray(s?.net?.deck)) {
				return {
					paid: { deck: s.paid.deck.map(String), pos: s.paid.pos | 0 },
					net: { deck: s.net.deck.map(String), pos: s.net.pos | 0 },
					count: s.count | 0
				};
			}
		}
	} catch {}
	return emptyState();
}

/** @param {PopupState} state */
function saveState(state) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {}
}

/**
 * שולף את הפרסומת הבאה מחפיסה מסוג אחד. החפיסה נבנית מחדש כשנגמרה או
 * כשהמאגר השתנה (מפרסם שאושר או הוסר אחרי שהחפיסה נשמרה).
 * @param {DeckState} state
 * @param {PopupAd[]} pool
 * @returns {PopupAd | null}
 */
function drawFrom(state, pool) {
	if (!pool.length) return null;
	const poolIds = new Set(pool.map((a) => String(a.id)));
	const stale = state.deck.length !== pool.length || state.deck.some((id) => !poolIds.has(id));
	if (stale || state.pos >= state.deck.length) {
		state.deck = shuffle(pool.map((a) => String(a.id)));
		state.pos = 0;
	}
	const id = state.deck[state.pos];
	state.pos += 1;
	return pool.find((a) => String(a.id) === id) ?? pool[0];
}

/** @returns {PopupAd | null} */
function getNextAd() {
	const paid = paidAds;
	const net = getNetworkAds();
	if (!paid.length && !net.length) return null;

	const state = loadState();
	const networkTurn = state.count % NETWORK_AD_EVERY === NETWORK_AD_EVERY - 1;
	const useNetwork = !paid.length || (networkTurn && net.length > 0);

	const ad = useNetwork
		? (drawFrom(state.net, net) ?? drawFrom(state.paid, paid))
		: (drawFrom(state.paid, paid) ?? drawFrom(state.net, net));

	if (ad) {
		state.count += 1;
		saveState(state);
	}
	return ad;
}

/** @type {import('svelte/store').Writable<{ ad: PopupAd, pendingHref?: string } | null>} */
export const adPopup = writable(null);

/**
 * פותח פרסומת בנייד; מחזיר false בדסקטופ או כשאין פרסומת — ואז הקורא
 * ממשיך בניווט הרגיל.
 * @param {string} [pendingHref] לאן להמשיך כשהפרסומת נסגרת
 */
export function triggerAdPopup(pendingHref) {
	if (typeof window !== 'undefined' && window.innerWidth >= 1024) return false;
	const ad = getNextAd();
	if (!ad) return false;
	adPopup.set({ ad, pendingHref });
	return true;
}

export function closeAdPopup() {
	adPopup.set(null);
}

/**
 * onclick לקישור לעסק: בנייד — עוצר את הניווט ומציג פרסומת, שבסופה
 * ממשיכים ליעד. לחיצה עם מקש (לשונית חדשה) עוברת כרגיל.
 * @param {MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement }} e
 */
export function adGateClick(e) {
	if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
		return;
	const href = e.currentTarget.getAttribute('href');
	if (href && triggerAdPopup(href)) e.preventDefault();
}
