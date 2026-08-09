<script>
	// מזריק schema.org JSON-LD ל-<head>. מקבל אובייקט אחד או מערך אובייקטים.
	/** @type {{ data: unknown }} */
	let { data } = $props();

	// בריחת "<" מונעת סגירה מוקדמת של תג ה-script בתוך המחרוזת
	const json = $derived(JSON.stringify(data).replace(/</g, '\\u003c'));
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${json}</script>`}
</svelte:head>
