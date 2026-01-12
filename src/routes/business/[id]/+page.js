export async function load({ fetch, params }) {
    const id = params.id;
    try {
        const response = await fetch('/api/businesses');
        if (!response.ok) throw new Error('Failed to fetch businesses');
        const businesses = await response.json();

        // Find business by id (which is the index in our API)
        const business = businesses.find((/** @type {any} */ b) => String(b.id) === String(id));

        if (!business) {
            return {
                status: 404,
                error: new Error('Business not found')
            };
        }

        // Helper to format business data
        /** @param {string} url */
        const getDirectImageUrl = (url) => {
            if (!url) return '';
            return url.trim();
        };

        /** @param {any} row @param {string} partialKey */
        const findValue = (row, partialKey) => {
            const key = Object.keys(row).find((k) => k.includes(partialKey));
            return key ? row[key] : '';
        };

        let rawImages = business['הוסף תמונה לבאנר'] || '';
        let bannerArray = [];
        if (rawImages) {
            bannerArray = rawImages.split(',').map((/** @type {string} */ url) => getDirectImageUrl(url.trim()));
        }

        /** @param {string} text */
        const cleanText = (text) => {
            if (!text) return '';
            const cleaned = text
                .replace(/אחר[,\s:\-\.]*אפרט\s*(למטה|למה)?/g, '')
                .replace(/^[,\s:\-\.]+|[,\s:\-\.]+$/g, '')
                .trim();
            // אם נשאר רק טקסט שהוא סימני פיסוק או רווחים - החזר מחרוזת ריקה
            return !cleaned || /^[,\s:\-\.\|]+$/.test(cleaned) ? '' : cleaned;
        };

        // לוגו מעמודה J (מעובד כבר בשרת)
        const jLogo = business.logoFromColumnJ || '';
        const currentLogo = business['לוגו'] || '';
        const primaryLogo = jLogo || currentLogo;
        const fallbackLogo = currentLogo;

        /** @param {string} url */
        const getYoutubeEmbedUrl = (url) => {
            if (!url) return '';
            let videoId = '';
            const patterns = [
                /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
                /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/,
                /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/
            ];
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) {
                    videoId = match[1];
                    break;
                }
            }
            return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
        };

        const rawYoutube = findValue(business, 'YouTube') || findValue(business, 'יוטיוב') || findValue(business, 'סרטון');
        const defaultYoutube = 'https://www.youtube.com/embed/CjBbU2ZOsa8';
        const youtubeEmbed = getYoutubeEmbedUrl(rawYoutube) || defaultYoutube;

        const formattedBusiness = {
            id: business.id,
            name: business['שם העסק או השירות '] || business['שם העסק'] || 'ללא שם',
            phone: business['טלפון '] || business['טלפון'] || '',
            category: cleanText(business['קטגוריה'] || business['Category'] || 'כללי'),
            banners: bannerArray,
            description: cleanText(business['הערות'] || business['תיאור'] || ''),
            discount: cleanText(findValue(business, 'ההנחה הבלעדית')),
            salesArea: cleanText(business['אזור מכירה ארצי (אנטרנטי). אם האיזור פרטי נא לפרט היכן'] || ''),
            address: cleanText(business['מיקום המפעל / חנות / מחסן'] || ''),
            deliveries: cleanText(business['שירות משלוחים'] || ''),
            website: business['אתר'] || business['Website'] || '',
            logo: primaryLogo,
            fallbackLogo: fallbackLogo,
            youtube: youtubeEmbed
        };

        return {
            business: formattedBusiness
        };
    } catch (err) {
        return {
            status: 500,
            error: err
        };
    }
}
