(function(){
	'use strict'
	var grid=document.getElementById('visa-grid')
	var DATA_FILES=['/assets/visa-data-1.js','/assets/visa-data-2.js','/assets/visa-data-3.js','/assets/visa-data-4.js']
	var BADGES={free:'\u0411\u0435\u0437 \u0432\u0438\u0437\u044b',arrival:'\u0412\u0438\u0437\u0430 \u043f\u043e \u043f\u0440\u0438\u043b\u0451\u0442\u0435',advance:'\u0412\u0438\u0437\u0430 \u0437\u0430\u0440\u0430\u043d\u0435\u0435'}

	function normalize(value){
		return String(value||'').toLowerCase().replace(/\u0451/g,'\u0435').trim()
	}

	function plural(count){
		var mod100=count%100
		var mod10=count%10
		if(mod100>=11&&mod100<=14)return '\u0441\u0442\u0440\u0430\u043d'
		if(mod10===1)return '\u0441\u0442\u0440\u0430\u043d\u0430'
		if(mod10>=2&&mod10<=4)return '\u0441\u0442\u0440\u0430\u043d\u044b'
		return '\u0441\u0442\u0440\u0430\u043d'
	}

	function escape(value){
		return String(value||'').replace(/[&<>"]/g,function(char){
			return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]
		})
	}

	function loadScript(src){
		return new Promise(function(resolve){
			var node=document.createElement('script')
			node.src=src
			node.onload=resolve
			node.onerror=resolve
			document.head.appendChild(node)
		})
	}

	function render(country){
		var visa=BADGES[country.visa]?country.visa:'advance'
		var card=document.createElement('details')
		card.className='visa-card'
		card.id=country.id
		card.setAttribute('data-visa',visa)
		card.setAttribute('data-search',[country.name,country.region,BADGES[visa]].join(' '))
		card.innerHTML='<summary><span class="visa-flag" aria-hidden="true">'+escape(country.flag)+'</span>'+
			'<span class="visa-head"><span class="visa-name">'+escape(country.name)+'</span>'+
			'<span class="visa-region">'+escape(country.region)+'</span></span>'+
			'<span class="visa-badge '+visa+'">'+BADGES[visa]+'</span></summary>'+
			'<div class="visa-body"><dl>'+
			'<div><dt>\u0412\u0438\u0437\u043e\u0432\u044b\u0439 \u0440\u0435\u0436\u0438\u043c \u0438 \u0441\u0440\u043e\u043a</dt><dd>'+escape(country.stay)+'</dd></div>'+
			'<div><dt>\u0417\u0430\u0433\u0440\u0430\u043d\u043f\u0430\u0441\u043f\u043e\u0440\u0442</dt><dd>'+escape(country.passport)+'</dd></div>'+
			'<div><dt>\u0427\u0442\u043e \u0432\u0430\u0436\u043d\u043e \u0443\u0447\u0435\u0441\u0442\u044c</dt><dd>'+escape(country.extra)+'</dd></div>'+
			'</dl><p class="visa-links"><a href="#tour-request" data-open-modal>\u041f\u043e\u0434\u043e\u0431\u0440\u0430\u0442\u044c \u0442\u0443\u0440 \u0432 '+escape(country.name)+'</a></p>'+
			'<p class="visa-source">\u0414\u0430\u043d\u043d\u044b\u0435 \u0430\u043a\u0442\u0443\u0430\u043b\u0438\u0437\u0438\u0440\u0443\u044e\u0442\u0441\u044f \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u043e\u043c \u043f\u0435\u0440\u0435\u0434 \u0431\u0440\u043e\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435\u043c. \u0423\u0442\u043e\u0447\u043d\u0438\u0442\u0435 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f \u043d\u0430 \u0434\u0430\u0442\u0443 \u0432\u0430\u0448\u0435\u0439 \u043f\u043e\u0435\u0437\u0434\u043a\u0438.</p></div>'
		return card
	}

	function init(){
		var extra=Array.isArray(window.VISA_EXTRA)?window.VISA_EXTRA:[]
		var fragment=document.createDocumentFragment()
		extra.sort(function(a,b){return String(a.name).localeCompare(String(b.name),'ru')}).forEach(function(country){
			if(!country||!country.id||document.getElementById(country.id))return
			fragment.appendChild(render(country))
		})
		grid.appendChild(fragment)

		var cards=Array.prototype.slice.call(grid.querySelectorAll('.visa-card'))
		var search=document.getElementById('visa-search')
		var counter=document.getElementById('visa-count')
		var empty=document.getElementById('visa-empty')
		var chips=Array.prototype.slice.call(document.querySelectorAll('.visa-chip'))
		var filter='all'

		var metrics=Array.prototype.slice.call(document.querySelectorAll('.visa-metrics b'))
		var freeCount=cards.filter(function(card){return card.getAttribute('data-visa')==='free'}).length
		if(metrics[0])metrics[0].textContent=String(cards.length)
		if(metrics[1])metrics[1].textContent=String(freeCount)

		var apply=function(){
			var query=normalize(search?search.value:'')
			var shown=0
			cards.forEach(function(card){
				var byFilter=filter==='all'||card.getAttribute('data-visa')===filter
				var haystack=normalize(card.getAttribute('data-search'))
				var byQuery=!query||haystack.indexOf(query)!==-1
				var visible=byFilter&&byQuery
				card.hidden=!visible
				if(!visible&&card.open)card.open=false
				if(visible)shown++
			})
			if(counter)counter.textContent='\u041d\u0430\u0439\u0434\u0435\u043d\u043e '+shown+' '+plural(shown)
			if(empty)empty.hidden=shown!==0
		}

		if(search){
			search.addEventListener('input',apply)
			search.addEventListener('search',apply)
		}

		chips.forEach(function(chip){
			chip.addEventListener('click',function(){
				filter=chip.getAttribute('data-filter')||'all'
				chips.forEach(function(item){
					var active=item===chip
					item.classList.toggle('is-active',active)
					item.setAttribute('aria-pressed',active?'true':'false')
				})
				apply()
			})
		})

		grid.addEventListener('toggle',function(event){
			var card=event.target
			if(!card.open||!card.classList||!card.classList.contains('visa-card'))return
			cards.forEach(function(item){
				if(item!==card)item.open=false
			})
		},true)

		var dialog=document.getElementById('tour-request')
		grid.addEventListener('click',function(event){
			var trigger=event.target.closest?event.target.closest('[data-open-modal]'):null
			if(!trigger||!dialog||!dialog.showModal)return
			event.preventDefault()
			dialog.showModal()
		})

		var openFromHash=function(){
			var id=(window.location.hash||'').replace('#','')
			if(!id)return
			var target=document.getElementById(id)
			if(!target||!target.classList.contains('visa-card'))return
			target.hidden=false
			target.open=true
			target.scrollIntoView({block:'center'})
		}

		apply()
		openFromHash()
		window.addEventListener('hashchange',openFromHash)
	}

	if(grid){
		Promise.all(DATA_FILES.map(loadScript)).then(init)
	}

	Array.prototype.slice.call(document.querySelectorAll('form[data-lead-form]')).forEach(function(form){
		var consents=form.querySelector('.consents')
		if(!consents||form.querySelector('[name="countryInfoAcknowledged"]'))return
		var label=document.createElement('label')
		label.innerHTML='<input type="checkbox" name="countryInfoAcknowledged" required><span>\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044e \u043e\u0437\u043d\u0430\u043a\u043e\u043c\u043b\u0435\u043d\u0438\u0435 \u0441 <a href="/legal/travel-information.html">\u043f\u0440\u0430\u0432\u0438\u043b\u0430\u043c\u0438 \u0432\u044a\u0435\u0437\u0434\u0430 \u0438 \u043f\u0440\u0435\u0431\u044b\u0432\u0430\u043d\u0438\u044f</a> \u0432 \u0441\u0442\u0440\u0430\u043d\u0435 \u043e\u0442\u0434\u044b\u0445\u0430</span>'
		consents.insertBefore(label,consents.firstChild)
		var submit=form.querySelector('button[type="submit"]')
		var sync=function(){
			if(submit)submit.disabled=!form.checkValidity()
		}
		form.addEventListener('change',sync)
		form.addEventListener('input',sync)
		sync()
	})
})()
