// ============================================================
// אריחי הבסיס של שתי המפות (מפת העסקים בדף הבית ומפת אזור העבודה
// בדף העסק) — מקור אחד לכתובת, כדי שהספק יתחלף במקום אחד.
//
// למה לא OSM רגיל: אריחי OSM צורבים את שמות היישובים אל תוך התמונה,
// ובאזור שלנו הם מגיעים בערבית לצד העברית — אין דרך לסנן שפה מ-PNG
// מוכן. לכן בסיס בלי שום כיתוב, והשמות נכתבים מעליו בעברית על ידי
// המפות עצמן (ראו cityLabels ב-serviceArea).
//
// שני ספקים חסרי-כיתוב, לפי מה שיש בסביבה:
//
//   עם מפתח  CARTO Voyager no-labels — צבעוני ויפה, אבל מספטמבר 2026
//            CARTO דורשת מפתח גם לאריחים החינמיים, ובלעדיו האריחים
//            מגיעים עם סימן מים "API KEY REQUIRED" צרוב בתוך התמונה.
//            המפתח חינמי (carto.com/basemaps/apikey — אימייל, דומיין
//            ותיאור קצר, בלי חשבון), מכסתו 5 מיליון אריחים בחודש, והוא
//            ציבורי מטבעו (נשלח מהדפדפן עם כל אריח) — ולכן PUBLIC_.
//
//   בלי מפתח Esri Light Gray Canvas (Base בלבד, בלי שכבת ה-Reference
//            שמכילה את השמות) — בסיס אפור-בהיר שקט, בלי מפתח ובלי סימן
//            מים, עד זום 16 (המפות שלנו נעצרות ב-12–14). ברירת המחדל
//            בפועל כל עוד לא הוזן מפתח CARTO ב-Vercel.
// ============================================================

import * as publicVars from '$env/static/public';

const CARTO_KEY = publicVars['PUBLIC_CARTO_API_KEY'] || '';

const CARTO = {
	url:
		'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png' +
		`?key=${encodeURIComponent(CARTO_KEY)}`,
	options: { subdomains: 'abcd', maxZoom: 20 },
	attribution:
		'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a> · <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'
};

// שימו לב לסדר {y}/{x} — כך Esri ממענת אריחים
const ESRI = {
	url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
	options: { maxZoom: 16 },
	attribution:
		'<a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OSM</a>'
};

const provider = CARTO_KEY ? CARTO : ESRI;

/** כתובת האריחים בתבנית של Leaflet. */
export const BASEMAP_URL = provider.url;
/** אפשרויות ל-L.tileLayer (תת-דומיינים, זום מרבי). */
export const BASEMAP_OPTIONS = provider.options;
/** שורת הקרדיט הנדרשת ברישיון של הספק הנבחר. */
export const BASEMAP_ATTRIBUTION = provider.attribution;
