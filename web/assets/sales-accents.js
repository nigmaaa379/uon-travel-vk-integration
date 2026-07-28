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
	const addNavLink = () => {
		const nav = document.getElementById('main-nav') || document.querySelector('header nav')
		if (!nav || nav.querySelector('a[href*="cruises"]')) return
		const links = nav.querySelectorAll('a')
		if (!links.length) return
		const sample = links[0]
		const link = sample.cloneNode(false)
		link.setAttribute('href', '/cruises.html')
		link.removeAttribute('aria-current')
		link.textContent = 'Круизы'
		sample.insertAdjacentElement('afterend', link)
	}
	const addFooterLink = () => {
		const columns = document.querySelectorAll('footer .footer-grid > div')
		const footer = document.querySelector('footer')
		if (!footer || footer.querySelector('a[href*="cruises"]')) return
		const contacts = columns[1]
		if (!contacts) return
		const sample = contacts.querySelector('a')
		if (!sample) return
		const link = sample.cloneNode(false)
		link.setAttribute('href', '/cruises.html')
		link.textContent = 'Морские круизы'
		contacts.appendChild(link)
	}
	const whenRail = callback => {
		const found = document.querySelector('.sales-rail')
		if (found) { callback(found); return }
		const observer = new MutationObserver(() => {
			const rail = document.querySelector('.sales-rail')
			if (!rail) return
			observer.disconnect()
			callback(rail)
		})
		observer.observe(document.body, { childList: true, subtree: true })
		setTimeout(() => observer.disconnect(), 15000)
	}
	const render = (rail, items) => {
		rail.innerHTML = items.slice(0, 3).map(card).join('')
		if (rail.dataset.accentsBound === '1') return
		rail.dataset.accentsBound = '1'
		rail.addEventListener('click', event => {
			const trigger = event.target.closest('[data-accent-request]')
			if (!trigger) return
			event.preventDefault()
			openRequest()
		})
	}
	addEventListener('DOMContentLoaded', async () => {
		try { addNavLink() } catch {}
		try { addFooterLink() } catch {}
		let items = null
		try {
			const response = await fetch('/data/sales-accents.json', { cache: 'no-cache' })
			if (!response.ok) return
			items = await response.json()
		} catch { return }
		if (!Array.isArray(items) || !items.length) return
		whenRail(rail => render(rail, items))
	})
})();
