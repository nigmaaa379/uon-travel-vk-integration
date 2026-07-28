(() => {
	const esc = value => String(value == null ? '' : value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
	const safeUrl = value => {
		const raw = String(value || '').trim()
		if (!raw) return ''
		if (/^\/[^/\s"'<>]*/.test(raw) && !raw.startsWith('//')) return raw
		if (/^https:\/\/[^\s"'<>]+$/.test(raw)) return raw
		return ''
	}
	const openRequest = () => {
		const dialog = document.getElementById('tour-request')
		if (dialog && typeof dialog.showModal === 'function') {
			try { dialog.showModal(); return } catch {}
		}
		const form = document.querySelector('[data-lead-form]')
		if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}
	const card = item => {
		const image = safeUrl(item.image)
		const link = safeUrl(item.link)
		const title = esc(item.title)
		const button = esc(item.button || 'Получить подборку')
		const external = link.startsWith('https://') ? ' target="_blank" rel="noopener"' : ''
		const media = image
			? (link
				? `<a class="sales-accent-media" href="${esc(link)}"${external}><img src="${esc(image)}" alt="${title}" loading="lazy"></a>`
				: `<button type="button" class="sales-accent-media" data-accent-request="1"><img src="${esc(image)}" alt="${title}" loading="lazy"></button>`)
			: ''
		const action = link
			? `<a class="sales-accent-link" href="${esc(link)}"${external}>${button}</a>`
			: `<button type="button" class="sales-accent-link" data-accent-request="1">${button}</button>`
		return `<article class="sales-accent${image ? ' has-media' : ''}">${media}<div class="sales-accent-body"><span class="sales-accent-label">${esc(item.label)}</span><h3>${title}</h3><p>${esc(item.text)}</p>${action}</div></article>`
	}
	addEventListener('DOMContentLoaded', async () => {
		const rail = document.querySelector('.sales-rail')
		if (!rail) return
		rail.addEventListener('click', event => {
			const trigger = event.target.closest('[data-accent-request]')
			if (!trigger) return
			event.preventDefault()
			openRequest()
		})
		try {
			const response = await fetch('/data/sales-accents.json', { cache: 'no-cache' })
			if (!response.ok) return
			const items = await response.json()
			if (!Array.isArray(items) || !items.length) return
			rail.innerHTML = items.slice(0, 3).map(card).join('')
		} catch {}
	})
})();
