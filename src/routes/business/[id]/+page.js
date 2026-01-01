export async function load({ fetch, params }) {
    const id = params.id;
    try {
        const response = await fetch('/api/businesses');
        if (!response.ok) throw new Error('Failed to fetch businesses');
        const businesses = await response.json();

        // Find business by id (which is the index in our API)
        const business = businesses.find(b => String(b.id) === String(id));

        if (!business) {
            return {
                status: 404,
                error: new Error('Business not found')
            };
        }

        // Helper to format business data
        const getDirectImageUrl = (url) => {
            if (!url) return '';
            if (url.includes('drive.google.com') && url.includes('id=')) {
                const idMatch = url.match(/id=([^&]+)/);
                if (idMatch && idMatch[1]) {
                    return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
                }
            }
            return url;
        };

        const findValue = (row, partialKey) => {
            const key = Object.keys(row).find((k) => k.includes(partialKey));
            return key ? row[key] : '';
        };

        let rawImages = business['הוסף תמונה לבאנר'] || '';
        let bannerArray = [];
        if (rawImages) {
            bannerArray = rawImages.split(',').map(url => getDirectImageUrl(url.trim()));
        }

        const cleanText = (text) => {
            if (!text) return '';
            const cleaned = text
                .replace(/אחר[,\s:\-\.]*אפרט\s*(למטה|למה)?/g, '')
                .replace(/^[,\s:\-\.]+|[,\s:\-\.]+$/g, '')
                .trim();
            return cleaned.length <= 1 && /^[,\s:\-\.]$/.test(cleaned) ? '' : cleaned;
        };

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
            logo: getDirectImageUrl(business['לוגו']) || ''
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
