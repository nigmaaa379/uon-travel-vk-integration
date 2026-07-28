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
	const hasCruiseLink = scope => Boolean(scope && scope.querySelector('a[href*="cruises"]'))
	const addNavLink = () => {
		const nav = document.querySelector('header nav') || document.querySelector('.nav') || document.querySelector('#main-nav')
		if (!nav || hasCruiseLink(nav)) return
		const links = nav.querySelectorAll('a')
		if (!links.length) return
		const sample = links[0]
		const link = sample.cloneNode(false)
		link.setAttribute('href', '/cruises.html')
		link.removeAttribute('aria-current')
		link.textContent = 'Круизы'
		const parent = sample.parentElement
		if (parent && parent !== nav && parent.tagName === 'LI') {
			const item = parent.cloneNode(false)
			item.appendChild(link)
			parent.parentElement.insertBefore(item, parent.nextSibling)
			return
		}
		sample.insertAdjacentElement('afterend', link)
	}
	const addFooterLink = () => {
		const footer = document.querySelector('footer')
		if (!footer || hasCruiseLink(footer)) return
		const sample = footer.querySelector('a[href^="/"]:not([href^="//"])')
		if (!sample) return
		const link = sample.cloneNode(false)
		link.setAttribute('href', '/cruises.html')
		link.textContent = 'Морские круизы'
		const parent = sample.parentElement
		if (parent && parent.tagName === 'LI') {
			const item = parent.cloneNode(false)
			item.appendChild(link)
			parent.parentElement.insertBefore(item, parent.nextSibling)
			return
		}
		sample.insertAdjacentElement('afterend', link)
	}
	addEventListener('DOMContentLoaded', async () => {
		try { addNavLink() } catch {}
		try { addFooterLink() } catch {}
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
