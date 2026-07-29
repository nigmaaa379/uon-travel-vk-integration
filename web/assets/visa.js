(function(){
	'use strict'
	var grid=document.getElementById('visa-grid')

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

	if(grid){
		var cards=Array.prototype.slice.call(grid.querySelectorAll('.visa-card'))
		var search=document.getElementById('visa-search')
		var counter=document.getElementById('visa-count')
		var empty=document.getElementById('visa-empty')
		var chips=Array.prototype.slice.call(document.querySelectorAll('.visa-chip'))
		var filter='all'

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
