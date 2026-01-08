<script>
	import { onMount } from 'svelte';
	import { lang, translations } from '$lib/i18n';

	/** @type {{ businesses: any[] }} */
	let { businesses = [] } = $props();

	/** @type {any} */
	let mapElement;
	/** @type {any} */
	let map;
	/** @type {any} */
	let markersLayer;

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang]);

	// Coordinates for major cities and towns in Israel
	const CITY_COORDINATES = {
		ירושלים: { lat: 31.7683, lng: 35.2137 },
		'בני ברק': { lat: 32.0849, lng: 34.8352 },
		'תל אביב': { lat: 32.0853, lng: 34.7818 },
		'תל אביב-יפו': { lat: 32.0853, lng: 34.7818 },
		אשדוד: { lat: 31.8044, lng: 34.6553 },
		'בית שמש': { lat: 31.747, lng: 34.9881 },
		'ביתר עילית': { lat: 31.6965, lng: 35.108 },
		'מודיעין עילית': { lat: 31.9361, lng: 35.0375 },
		חיפה: { lat: 32.794, lng: 34.9896 },
		'פתח תקווה': { lat: 32.084, lng: 34.8878 },
		נתניה: { lat: 32.3215, lng: 34.8532 },
		צפת: { lat: 32.9646, lng: 35.496 },
		אלעד: { lat: 32.0515, lng: 34.9576 },
		רחובות: { lat: 31.8928, lng: 34.8113 },
		'באר שבע': { lat: 31.2518, lng: 34.7913 },
		אילת: { lat: 29.5577, lng: 34.9519 },
		חולון: { lat: 32.0158, lng: 34.7874 },
		'ראשון לציון': { lat: 31.973, lng: 34.7925 },
		הרצליה: { lat: 32.1624, lng: 34.8447 },
		'בת ים': { lat: 32.0132, lng: 34.747 },
		'רמת גן': { lat: 32.0684, lng: 34.8238 },
		רעננה: { lat: 32.1848, lng: 34.8713 },
		'כפר סבא': { lat: 32.175, lng: 34.9068 },
		חדרה: { lat: 32.434, lng: 34.9197 },
		'קריית שמונה': { lat: 33.2073, lng: 35.5721 },
		נצרת: { lat: 32.6996, lng: 35.3035 },
		עכו: { lat: 32.926, lng: 35.0827 },
		נהריה: { lat: 33.0114, lng: 35.0927 },
		טבריה: { lat: 32.7959, lng: 35.5312 },
		רמלה: { lat: 31.9318, lng: 34.8736 },
		לוד: { lat: 31.951, lng: 34.888 },
		מודיעין: { lat: 31.8906, lng: 35.0104 },
		אשקלון: { lat: 31.6688, lng: 34.5743 },
		'קרית מלאכי': { lat: 31.741, lng: 34.743 },
		נתיבות: { lat: 31.417, lng: 34.588 },
		שדרות: { lat: 31.5219, lng: 34.5962 },
		ערד: { lat: 31.261, lng: 35.214 },
		דימונה: { lat: 31.069, lng: 35.028 },
		חריש: { lat: 32.458, lng: 35.045 },
		עמנואל: { lat: 32.162, lng: 35.15 },
		'נוף הגליל': { lat: 32.709, lng: 35.318 },
		כרמיאל: { lat: 32.919, lng: 35.295 },
		מגדל: { lat: 32.81, lng: 35.494 },
		'קרית גת': { lat: 31.61, lng: 34.764 },
		רכסים: { lat: 32.7533, lng: 35.1054 }
	};

	// Sort cities by length descending to match specific names first
	const sortedCities = Object.entries(CITY_COORDINATES).sort((a, b) => b[0].length - a[0].length);

	/** @param {any} business */
	function getCoordinates(business) {
		const address = (business.address || '').toString().trim().toLowerCase();
		const salesArea = (business.salesArea || '').toString().trim().toLowerCase();
		const combinedText = `${address} ${salesArea}`;

		// Try to find a city match in the address or sales area
		for (const [city, coords] of sortedCities) {
			const cityLower = city.toLowerCase();
			if (combinedText.includes(cityLower)) {
				// Add slight random jitter to prevent perfect overlap
				const jitter = 0.005;
				return {
					lat: coords.lat + (Math.random() - 0.5) * jitter,
					lng: coords.lng + (Math.random() - 0.5) * jitter
				};
			}
		}

		// Fallback: Check for general regions
		if (combinedText.includes('ארצי') || combinedText.includes('כל הארץ')) {
			// Place national businesses in Jerusalem (center of Israel)
			return {
				lat: 31.7683 + (Math.random() - 0.5) * 0.1,
				lng: 35.2137 + (Math.random() - 0.5) * 0.1
			};
		}

		// Check for region keywords
		if (combinedText.includes('צפון') || combinedText.includes('גליל')) {
			return { lat: 32.8 + (Math.random() - 0.5) * 0.2, lng: 35.2 + (Math.random() - 0.5) * 0.2 };
		}
		if (combinedText.includes('דרום') || combinedText.includes('נגב')) {
			return { lat: 31.0 + (Math.random() - 0.5) * 0.3, lng: 34.8 + (Math.random() - 0.5) * 0.2 };
		}
		if (
			combinedText.includes('מרכז') ||
			combinedText.includes('גוש דן') ||
			combinedText.includes('שרון')
		) {
			return { lat: 32.08 + (Math.random() - 0.5) * 0.1, lng: 34.82 + (Math.random() - 0.5) * 0.1 };
		}

		// If nothing found, log for debugging and return null
		console.warn(
			`❌ No location found for: "${business.name}" - Address: "${business.address}" - Sales Area: "${business.salesArea}"`
		);
		return null;
	}

	onMount(() => {
		// Load Leaflet CSS
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
		link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
		link.crossOrigin = '';
		document.head.appendChild(link);

		// Load Leaflet JS
		const script = document.createElement('script');
		script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
		script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
		script.crossOrigin = '';

		script.onload = () => {
			initMap();
		};

		document.head.appendChild(script);

		return () => {
			if (map) {
				map.remove();
			}
		};
	});

	function initMap() {
		if (!mapElement || !window.L) return;

		const L = window.L;

		// Define Israel bounds (approximate)
		const israelBounds = L.latLngBounds(
			L.latLng(29.4, 34.2), // Southwest corner (Eilat area)
			L.latLng(33.3, 35.9) // Northeast corner (Golan Heights)
		);

		// Initialize the map centered on Israel with bounds restriction
		map = L.map(mapElement, {
			center: [31.5, 35.0],
			zoom: 8,
			minZoom: 7,
			maxZoom: 15,
			maxBounds: israelBounds,
			maxBoundsViscosity: 1.0, // Prevents dragging outside bounds
			scrollWheelZoom: true
		});

		// Add OpenStreetMap tiles
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19
		}).addTo(map);

		// Create a layer group for markers
		markersLayer = L.layerGroup().addTo(map);

		updateMarkers();
	}

	function updateMarkers() {
		if (!map || !window.L || !markersLayer) return;

		const L = window.L;

		// Clear existing markers
		markersLayer.clearLayers();

		let validBusinesses = 0;
		let skippedBusinesses = 0;

		businesses.forEach((business) => {
			const coords = getCoordinates(business);
			if (coords) {
				validBusinesses++;

				// Create custom icon
				const icon = L.icon({
					iconUrl:
						'data:image/svg+xml;base64,' +
						btoa(`
						<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
							<path fill="#ef4444" stroke="#fff" stroke-width="2" d="M16 0C10.5 0 6 4.5 6 10c0 8 10 20 10 20s10-12 10-20c0-5.5-4.5-10-10-10z"/>
							<circle cx="16" cy="10" r="4" fill="#fff"/>
						</svg>
					`),
					iconSize: [32, 40],
					iconAnchor: [16, 40],
					popupAnchor: [0, -40]
				});

				const marker = L.marker([coords.lat, coords.lng], { icon }).addTo(markersLayer);

				// Add tooltip (shows on hover)
				marker.bindTooltip(business.name, {
					direction: 'top',
					offset: [0, -35],
					className: 'business-tooltip'
				});

				// Add click event to navigate directly to business page
				marker.on('click', () => {
					window.location.href = `/business/${business.id}`;
				});

				// Create popup content
				const popupContent = `
					<div style="text-align: right; direction: rtl; min-width: 200px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
						<h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #1f2937;">${business.name}</h3>
						<p style="margin: 0 0 4px 0; font-size: 13px; color: #6b7280;">
							<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">
								${business.category}
							</span>
						</p>
						${
							business.address
								? `<p style="margin: 4px 0; font-size: 12px; color: #4b5563;">📍 ${business.address}</p>`
								: ''
						}
						${
							business.discount
								? `<p style="margin: 4px 0; font-size: 12px; color: #059669; font-weight: 500;">🎁 ${business.discount}</p>`
								: ''
						}
						<a href="/business/${business.id}" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: linear-gradient(to right, #2563eb, #7c3aed); color: white; text-decoration: none; border-radius: 8px; font-size: 12px; font-weight: bold;">
							מעבר לעסק >>
						</a>
					</div>
				`;

				marker.bindPopup(popupContent, {
					maxWidth: 300,
					className: 'custom-popup'
				});
			} else {
				skippedBusinesses++;
			}
		});

		console.log(
			`✅ Displayed ${validBusinesses} businesses on the map (${skippedBusinesses} skipped - no location found)`
		);
	}

	// Reactively update markers when businesses change
	$effect(() => {
		if (businesses.length > 0 && map) {
			updateMarkers();
		}
	});
</script>

<div class="map-container">
	<div bind:this={mapElement} class="map"></div>
</div>

<style>
	.map-container {
		width: 100%;
		height: 100%;
		border-radius: 1rem;
		overflow: hidden;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
	}

	.map {
		width: 100%;
		height: 100%;
		min-height: 500px;
		background: #e5e7eb;
	}

	:global(.leaflet-popup-content-wrapper) {
		border-radius: 12px;
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
	}

	:global(.leaflet-popup-tip) {
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
	}
	:global(.business-tooltip) {
		background: rgba(31, 41, 55, 0.95) !important;
		border: none !important;
		border-radius: 8px !important;
		padding: 8px 12px !important;
		font-size: 14px !important;
		font-weight: 600 !important;
		color: white !important;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3) !important;
		direction: rtl !important;
		text-align: center !important;
	}

	:global(.business-tooltip::before) {
		border-top-color: rgba(31, 41, 55, 0.95) !important;
	}
</style>
