const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const drawer=$('.mobile-drawer'), overlay=$('.overlay'), toggle=$('.mobile-toggle'), close=$('.close');
function setDrawer(open){
  if(!drawer)return;
  drawer.classList.toggle('open',open);
  overlay&&overlay.classList.toggle('open',open);
  drawer.setAttribute('aria-hidden',open?'false':'true');
  toggle?.setAttribute('aria-expanded',open?'true':'false');
  document.body.style.overflow=open?'hidden':'';
}
toggle&&toggle.addEventListener('click',()=>setDrawer(!drawer?.classList.contains('open')));
close&&close.addEventListener('click',()=>setDrawer(false));
overlay&&overlay.addEventListener('click',()=>setDrawer(false));
$$('.mobile-links a').forEach(a=>a.addEventListener('click',()=>setDrawer(false)));
$$('[data-year]').forEach(e=>e.textContent=new Date().getFullYear());


// Home catalog filters.
const homeFilters=[...$$('[data-home-filter]')];
const homeItems=[...$$('[data-home-category]')];
homeFilters.forEach(btn=>btn.addEventListener('click',()=>{
  homeFilters.forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  const category=btn.dataset.homeFilter||'all';
  homeItems.forEach(item=>{
    const show=category==='all'||item.dataset.homeCategory===category;
    item.hidden=!show;
  });
}));

// Carry product/category context into quote links from product cards and product sections.
function productContextFromLink(link){
  const scope=link.closest('.product-card,.catalog-item,.sport-card,.street-card');
  return {
    product:scope?.dataset.name||scope?.querySelector('h3')?.textContent.trim()||'',
    category:scope?.dataset.category||scope?.querySelector('small')?.textContent.trim()||''
  };
}
$$('a[href^="quote.html"]').forEach(link=>{
  const ctx=productContextFromLink(link);
  if(!ctx.product)return;
  const params=new URLSearchParams();
  params.set('product',ctx.product);
  if(ctx.category) params.set('category',ctx.category);
  link.href=`quote.html?${params.toString()}`;
});

// Shared incoming context for Quote / Order forms.
const incomingParams=new URLSearchParams(window.location.search);
const quoteProduct=incomingParams.get('product')||'';
const incomingCategory=incomingParams.get('category')||'';

// Product catalog search: Google-style suggestions + query navigation.
const searchInput=$('[data-product-search]');
const cards=[...$$('.product-card[data-category]')];
const filters=[...$$('.filter[data-filter]')];
const count=$('[data-result-count]');
const empty=$('[data-catalog-empty]');
const searchButton=document.querySelector('[data-product-search-submit]');
const suggestionBox=document.querySelector('#product-search-suggestions');
let activeFilter='all';
let activeSuggestion=-1;

const productData=cards.map((card,index)=>({
  index,
  name:card.dataset.name||card.querySelector('h3')?.textContent.trim()||'Product',
  category:card.dataset.category||'',
  description:card.dataset.description||'',
  image:card.dataset.image||card.querySelector('img')?.getAttribute('src')||''
}));

const normalizeSearch=v=>String(v||'')
  .toLowerCase()
  .replace(/&/g,' and ')
  .replace(/[^a-z0-9]+/g,' ')
  .replace(/\s+/g,' ')
  .trim();

// V41 — broad customer-language vocabulary for every catalog item.
// Search is intentionally forgiving: buyers can use common US/UK terms,
// singular/plural forms, spacing variations, or everyday apparel words.
const productSearchTerms={
  'football soccer kits':[
    'football kit','football kits','soccer kit','soccer kits','football jersey','football jerseys',
    'soccer jersey','soccer jerseys','jersey','jerseys','team kit','team kits','match kit','match kits',
    'football uniform','football uniforms','soccer uniform','soccer uniforms','sports uniform','sports uniforms',
    'football shirt','football shirts','soccer shirt','soccer shirts','match jersey','club kit'
  ],
  'tracksuits':[
    'tracksuit','track suit','track suits','warm up suit','warm up suits','warmup suit','warmup suits',
    'warm up set','warmup set','sports tracksuit','athletic tracksuit','training tracksuit','team tracksuit',
    'track jacket set','jogging suit','jogging suits'
  ],
  'teamwear':[
    'team wear','team apparel','team clothing','club wear','clubwear','club apparel','club clothing',
    'sports team wear','sports team apparel','sportswear for teams','team uniform','team uniforms',
    'club uniform','club uniforms','team gear','club gear'
  ],
  'training wear':[
    'trainingwear','training apparel','training clothes','training clothing','training gear','training kit','training kits',
    'practice wear','practice apparel','practice clothes','practice kit','practice kits','workout training wear',
    'sports training wear','athletic training wear'
  ],
  'gym wear':[
    'gymwear','gym apparel','gym clothes','gym clothing','fitness wear','fitnesswear','fitness apparel','fitness clothes',
    'workout wear','workout apparel','workout clothes','workout clothing','active wear','activewear','athleisure',
    'exercise wear','exercise clothes','training clothes for gym'
  ],
  'running apparel':[
    'running wear','runningwear','running clothes','running clothing','running gear','running kit','running kits',
    'jogging wear','jogging clothes','jogging apparel','runner apparel','runners wear','athletic running wear',
    'performance running wear','activewear for running'
  ],
  'hoodies':[
    'hoodie','hooded sweatshirt','hooded sweatshirts','hooded top','hooded tops','pullover hoodie','pullover hoodies',
    'zip hoodie','zip hoodies','zip up hoodie','zip up hoodies','fleece hoodie','streetwear hoodie'
  ],
  't shirts':[
    't shirt','t shirts','tshirt','tshirts','tee','tees','tee shirt','tee shirts','shirt','shirts',
    'short sleeve shirt','short sleeve shirts','crew neck t shirt','crewneck t shirt','graphic tee','graphic tees',
    'streetwear tee','streetwear t shirt'
  ],
  'trousers':[
    'trouser','trousers','pants','pant','jogger','joggers','jogger pant','jogger pants','sweatpant','sweatpants',
    'track pant','track pants','tracksuit bottoms','track bottoms','bottom','bottoms','casual trousers',
    'streetwear pants','streetwear trousers','jogging bottoms'
  ],
  'sweatshirts':[
    'sweatshirt','sweater','sweaters','crewneck','crew neck','crewneck sweatshirt','crew neck sweatshirt',
    'jumper','jumpers','pullover sweatshirt','pull over sweatshirt','fleece sweatshirt','streetwear sweatshirt'
  ],
  'jackets':[
    'jacket','coat','coats','outerwear','outer wear','windbreaker','windbreakers','bomber','bomber jacket',
    'bomber jackets','varsity jacket','varsity jackets','shell jacket','lightweight jacket','streetwear jacket',
    'sports jacket','team jacket'
  ],
  'co ord sets':[
    'co ord','co ord set','co ord sets','coord','coord set','coord sets','matching set','matching sets',
    'two piece','two piece set','two piece sets','2 piece','2 piece set','2 piece sets','matching outfit',
    'matching outfits','coordinated set','coordinated sets','streetwear set','fashion set','lounge set','loungewear set'
  ]
};

function searchTextForProduct(name,category,description,extra=''){
  const key=normalizeSearch(name);
  const aliases=productSearchTerms[key]||[];
  return normalizeSearch([name,category,description,extra,...aliases].join(' '));
}
function queryTokens(value){
  const q=normalizeSearch(value);
  if(!q)return [];
  return q.split(' ').filter(Boolean);
}
function tokenMatchesHaystack(token,hay){
  if(hay.includes(token))return true;
  // Gentle singular/plural tolerance without aggressive stemming.
  if(token.length>3&&token.endsWith('s')&&hay.includes(token.slice(0,-1)))return true;
  if(token.length>3&&!token.endsWith('s')&&hay.includes(token+'s'))return true;
  return false;
}
function productMatchesSearch(card,value){
  const q=normalizeSearch(value);
  if(!q)return true;
  const hay=searchTextForProduct(
    card.dataset.name||'',
    card.dataset.category||'',
    card.dataset.description||'',
    card.innerText||''
  );
  if(hay.includes(q))return true;
  const words=queryTokens(q);
  return words.every(w=>tokenMatchesHaystack(w,hay));
}

function renderCatalog(query){
  const q=query ?? searchInput?.value ?? '';
  let visible=0;
  const ranked = normalizeSearch(q) ? getMatches(q) : [];
  const rank = new Map(ranked.map((p,i)=>[p.index,i]));
  cards.forEach((card,index)=>{
    const category=card.dataset.category||'';
    const matchCategory=activeFilter==='all'||category===activeFilter;
    const matchSearch=productMatchesSearch(card,q);
    const show=matchCategory&&matchSearch;
    card.style.display=show?'':'none';
    if(show) visible++;
    card.style.order = show && rank.has(index) ? String(rank.get(index)) : '';
  });
  if(count) count.textContent=`${visible} product ${visible===1?'category':'categories'}`;
  if(empty) empty.style.display=visible?'none':'block';
}

function getMatches(value){
  const q=normalizeSearch(value);
  if(!q) return productData.slice(0,7);
  const words=queryTokens(q);
  return productData.map((p)=>{
    const hay=searchTextForProduct(p.name,p.category,p.description);
    const name=normalizeSearch(p.name);
    const category=normalizeSearch(p.category);
    let score=0;
    if(name===q) score+=40;
    if(name.includes(q)) score+=20;
    if(hay.includes(q)) score+=12;
    words.forEach(w=>{
      if(tokenMatchesHaystack(w,name))score+=6;
      else if(tokenMatchesHaystack(w,category))score+=3;
      else if(tokenMatchesHaystack(w,hay))score+=1;
      else score-=20;
    });
    return {...p,score,allWords:words.every(w=>tokenMatchesHaystack(w,hay))};
  }).filter(p=>p.allWords&&p.score>0).sort((a,b)=>b.score-a.score).slice(0,7);
}

function hideSuggestions(){
  if(!suggestionBox)return;
  suggestionBox.classList.remove('open');
  activeSuggestion=-1;
  searchInput?.removeAttribute('aria-activedescendant');
  searchInput?.setAttribute('aria-expanded','false');
}
function showSuggestions(){
  if(!suggestionBox||!searchInput)return;
  const matches=getMatches(searchInput.value);
  if(!matches.length){hideSuggestions();return;}
  suggestionBox.innerHTML='';
  matches.forEach((p,i)=>{
    const btn=document.createElement('button');
    btn.type='button';btn.className='search-suggestion';btn.setAttribute('role','option');btn.id=`search-option-${i}`;btn.dataset.index=p.index;
    btn.innerHTML=`<img class="search-suggestion-icon" src="${p.image}" alt=""><span class="search-suggestion-copy"><strong>${p.name}</strong><span>${p.category}</span></span>`;
    btn.addEventListener('mousedown',(e)=>{e.preventDefault();goToProduct(p)});
    suggestionBox.appendChild(btn);
  });
  const more=document.createElement('div');
  more.className='search-suggestion-more';
  more.textContent='Press Enter or click search to view all matching products';
  suggestionBox.appendChild(more);
  suggestionBox.classList.add('open');
  searchInput.setAttribute('aria-expanded','true');
}

function goToProduct(product){
  if(!product)return;
  searchInput.value=product.name;
  renderCatalog(product.name);
  hideSuggestions();
  requestAnimationFrame(()=>cards[product.index]?.scrollIntoView({behavior:'smooth',block:'center'}));
}

function submitSearch(){
  if(!searchInput)return;
  const q=searchInput.value.trim();
  const matches=getMatches(q);
  if(matches.length===1){goToProduct(matches[0]);return;}
  renderCatalog(q);
  hideSuggestions();
  document.querySelector('.catalog-products')?.scrollIntoView({behavior:'smooth',block:'start'});
  const first=cards.find(card=>card.style.display!=='none');
  if(first) setTimeout(()=>first.scrollIntoView({behavior:'smooth',block:'center'}),350);
}

searchInput?.addEventListener('input',()=>{activeSuggestion=-1;renderCatalog();showSuggestions()});
searchInput?.addEventListener('focus',showSuggestions);
searchButton?.addEventListener('click',submitSearch);
searchInput?.addEventListener('keydown',e=>{
  const options=[...suggestionBox?.querySelectorAll('.search-suggestion')||[]];
  if((e.key==='ArrowDown'||e.key==='ArrowUp')&&options.length){
    e.preventDefault();
    activeSuggestion=e.key==='ArrowDown'?(activeSuggestion+1)%options.length:(activeSuggestion-1+options.length)%options.length;
    options.forEach((o,i)=>o.classList.toggle('active',i===activeSuggestion));
    searchInput.setAttribute('aria-activedescendant',options[activeSuggestion].id);
    options[activeSuggestion].scrollIntoView({block:'nearest'});
    return;
  }
  if(e.key==='Enter'){
    e.preventDefault();
    if(activeSuggestion>=0&&options[activeSuggestion]){
      const product=productData[Number(options[activeSuggestion].dataset.index)];
      goToProduct(product);
    }else submitSearch();
  }
  if(e.key==='Escape'){hideSuggestions();searchInput.blur()}
});
document.addEventListener('click',e=>{if(!e.target.closest('.catalog-search'))hideSuggestions()});
filters.forEach(btn=>btn.addEventListener('click',()=>{
  filters.forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  activeFilter=btn.dataset.filter||'all';
  renderCatalog();
}));

// Support direct search URLs, e.g. products.html?search=hoodie
const initialQuery=new URLSearchParams(window.location.search).get('search');
if(initialQuery&&searchInput){searchInput.value=initialQuery;renderCatalog(initialQuery);setTimeout(()=>document.querySelector('.catalog-products')?.scrollIntoView({behavior:'smooth',block:'start'}),150)}else if(cards.length){renderCatalog('')}

// Lightweight product quick-view modal.
const modal=$('[data-quick-modal]');
const modalImage=$('[data-quick-image]');
const modalTitle=$('[data-quick-title]');
const modalCategory=$('[data-quick-category]');
const modalDescription=$('[data-quick-description]');
const modalQuote=modal?.querySelector('a[href^="quote.html"]');
let quickReturnFocus=null;
function closeQuickView(){ if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';quickReturnFocus?.focus();quickReturnFocus=null;} }
function openQuickView(trigger){
  const card=trigger.closest('.product-card, .sport-card, .street-card, .catalog-item'); if(!card||!modal)return;
  quickReturnFocus=trigger;
  const nextImage=card.dataset.image||card.querySelector('img')?.src||'';
  // Never leave the previously viewed product visible while the next image loads.
  modalImage.style.opacity='0';
  modalImage.removeAttribute('src');
  modalImage.alt=card.dataset.name||'';
  if(nextImage){
    const loader=new Image();
    loader.onload=()=>{
      modalImage.src=nextImage;
      modalImage.style.opacity='1';
    };
    loader.onerror=()=>{
      modalImage.src=nextImage;
      modalImage.style.opacity='1';
    };
    loader.src=nextImage;
  }
  modalTitle.textContent=card.dataset.name||'Product';
  modalCategory.textContent=card.dataset.category||'';
  modalDescription.textContent=card.dataset.description||'';
  if(modalQuote){const p=new URLSearchParams();p.set('product',card.dataset.name||'');if(card.dataset.category)p.set('category',card.dataset.category);modalQuote.href=`quote.html?${p.toString()}`;}
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
  modal.querySelector('[data-close-modal]')?.focus();
}
$$('[data-quick-view], [data-quick-image-trigger]').forEach(trigger=>{
  trigger.addEventListener('click',()=>openQuickView(trigger));
  trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openQuickView(trigger)}});
});
$$('[data-close-modal]').forEach(el=>el.addEventListener('click',closeQuickView));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeQuickView();setDrawer(false);}});

// V35 — clear inline form validation.
function validationMessageFor(control){
  const label=control.closest('.field')?.querySelector('label')?.textContent?.replace(/\s*\*\s*$/,'').trim()||'This field';
  const v=control.validity;
  if(v.valueMissing) return `${label} is required.`;
  if(v.typeMismatch && control.type==='email') return 'Enter a valid email address (for example: name@company.com).';
  if(v.typeMismatch && control.type==='url') return 'Enter a complete link beginning with http:// or https://.';
  if(v.patternMismatch) return control.title || `Enter a valid ${label.toLowerCase()}.`;
  if(v.tooShort) return `${label} must be at least ${control.minLength} characters.`;
  if(v.rangeUnderflow) return `${label} must be at least ${control.min}.`;
  if(v.rangeOverflow) return `${label} must be ${control.max} or less.`;
  if(v.stepMismatch) return `${label} must increase in steps of ${control.step}.`;
  if(v.badInput) return `Enter a valid value for ${label.toLowerCase()}.`;
  return control.validationMessage || `Check ${label.toLowerCase()}.`;
}
function clearFieldError(control){
  const field=control.closest('.field'); if(!field)return;
  field.classList.remove('is-invalid');
  field.querySelector('.field-error')?.remove();
  if(control.value && control.checkValidity()) field.classList.add('is-valid'); else field.classList.remove('is-valid');
}
function showFieldError(control){
  const field=control.closest('.field'); if(!field)return;
  field.classList.add('is-invalid'); field.classList.remove('is-valid');
  let error=field.querySelector('.field-error');
  if(!error){error=document.createElement('span');error.className='field-error';field.appendChild(error);}
  error.textContent=validationMessageFor(control);
}
function validateQuoteContactField(form){
  const control=form.querySelector('input[name="contact"]');
  if(!control)return;
  control.setCustomValidity('');
  const value=control.value.trim();
  if(!value)return; // required handles empty values
  const email=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const phoneChars=/^\+?[0-9()\-\s]+$/;
  const digits=value.replace(/\D/g,'');
  const looksLikePhone=phoneChars.test(value)&&digits.length>=7&&digits.length<=15;
  if(!email.test(value)&&!looksLikePhone){
    control.setCustomValidity('Enter a valid email address or WhatsApp number.');
  }
}
function validateFormFields(form){
  validateQuoteContactField(form);
  const controls=[...form.querySelectorAll('input:not([type="hidden"]):not(.web3forms-botcheck), select, textarea')];
  controls.forEach(clearFieldError);
  const invalid=controls.filter(c=>!c.checkValidity());
  invalid.forEach(showFieldError);
  if(invalid.length){
    invalid[0].focus({preventScroll:true});
    invalid[0].closest('.field')?.scrollIntoView({behavior:'smooth',block:'center'});
    return false;
  }
  return true;
}
$$('form[data-web3forms] input, form[data-web3forms] select, form[data-web3forms] textarea').forEach(control=>{
  control.addEventListener('invalid',e=>{e.preventDefault();showFieldError(control)});
  control.addEventListener('input',()=>{if(control.name==='contact')validateQuoteContactField(control.form);clearFieldError(control)});
  control.addEventListener('change',()=>clearFieldError(control));
});

// Live inquiry forms via Web3Forms.
$$('form[data-web3forms]').forEach(form=>form.addEventListener('submit',async e=>{
  e.preventDefault();
  const status=form.querySelector('.form-message');
  const button=form.querySelector('button[type="submit"]');
  const originalText=button?.textContent;
  const accessKey=form.querySelector('input[name="access_key"]')?.value?.trim()||'';
  if(!accessKey || accessKey==='YOUR_WEB3FORMS_ACCESS_KEY'){
    if(status){status.textContent='Form setup is incomplete. Please contact DESPORTEX through WhatsApp or email.';status.className='form-message error';}
    return;
  }
  if(!validateFormFields(form)){
    if(status){status.textContent='Please correct the highlighted fields before submitting.';status.className='form-message error';}
    return;
  }
  if(button){button.disabled=true;button.textContent='Sending…';}
  if(status){status.textContent='Sending your inquiry…';status.className='form-message';}
  try{
    const data=Object.fromEntries(new FormData(form));
    const response=await fetch('https://api.web3forms.com/submit',{
      method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)
    });
    const result=await response.json();
    if(!response.ok||!result.success) throw new Error(result.message||'Submission failed');
    if(status){status.textContent='Thank you — your inquiry has been sent successfully. We’ll get back to you as soon as possible.';status.className='form-message success';}
    form.reset();
    // Restore incoming category/product context after reset.
    const resetCategory=form.querySelector('[data-product-category]');
    if(resetCategory && incomingCategory){
      const cv=matchCategoryValue(resetCategory,incomingCategory);
      if(cv){resetCategory.value=cv;setProductOptions(form,cv,quoteProduct);}
    }else if(quoteProduct){
      const productSelect=form.querySelector('[data-product-item]');
      if(productSelect)setProductOptions(form,'',quoteProduct);
    }
  }catch(err){
    if(status){status.textContent='We couldn’t send your inquiry. Please try again, or contact us through WhatsApp or email.';status.className='form-message error';}
  }finally{
    if(button){button.disabled=false;button.textContent=originalText;}
  }
}));

// V34 — structured B2B forms: dependent product dropdowns.
const desportexProducts={
  Sportswear:['Football / Soccer Kits','Tracksuits','Teamwear','Training Wear','Gym Wear','Running Apparel','Other Sportswear'],
  Streetwear:['Hoodies','T-Shirts','Trousers','Sweatshirts','Jackets','Co-Ord Sets','Other Streetwear'],
  'Private Label':['Private Label Apparel'],
  'Custom Manufacturing':['Custom Apparel Development'],
  Other:['Other / Not Listed']
};
function setProductOptions(form, category, preferred=''){
  const product=form.querySelector('[data-product-item]'); if(!product)return;
  const items=desportexProducts[category]||[];
  product.innerHTML=`<option value="">${category?'Select a product / item':'Select a category first'}</option>`;
  items.forEach(item=>product.add(new Option(item,item)));
  if(preferred){
    let option=[...product.options].find(o=>o.value.toLowerCase()===preferred.toLowerCase());
    if(!option){option=new Option(preferred,preferred);product.add(option)}
    product.value=option.value;
  }
}
function normalizeProductName(value){
  return (value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function matchCategoryValue(select,value){
  if(!select||!value)return '';
  const wanted=normalizeProductName(value);
  const opt=[...select.options].find(o=>normalizeProductName(o.value)===wanted||normalizeProductName(o.textContent)===wanted);
  return opt?.value||'';
}
$$('form[data-web3forms]').forEach(form=>{
  const category=form.querySelector('[data-product-category]');
  const product=form.querySelector('[data-product-item]');
  if(category){
    category.addEventListener('change',()=>setProductOptions(form,category.value));
    const incoming=quoteProduct;
    let matched=matchCategoryValue(category,incomingCategory);
    if(!matched && incoming){
      const wanted=normalizeProductName(incoming);
      for(const [cat,items] of Object.entries(desportexProducts)){
        if(items.some(i=>normalizeProductName(i)===wanted)){matched=matchCategoryValue(category,cat);break;}
      }
    }
    if(matched){
      category.value=matched;
      setProductOptions(form,matched,incoming);
    }else if(incoming && product){
      setProductOptions(form,'',incoming);
    }
  }
  // Order/quote pages can also contain ordinary selects: prefill them from URL when names match.
  for(const [key,value] of incomingParams.entries()){
    const field=form.elements.namedItem(key);
    if(!field||!value||field===category||field===product)continue;
    if(field.tagName==='SELECT'){const v=matchCategoryValue(field,value);if(v)field.value=v;}
    else if(!field.value)field.value=value;
  }
});

// V42 — launch-readiness safeguards.
// Close the mobile drawer if the viewport returns to desktop size.
window.addEventListener('resize',()=>{
  if(window.innerWidth>1080 && drawer?.classList.contains('open')) setDrawer(false);
});

// Prevent users from choosing a past target delivery date.
$$('input[type="date"]').forEach(input=>{
  if(!input.min){
    const now=new Date();
    const local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    input.min=local;
  }
});


// V43 — phone calling codes follow the selected country where a known code is available.
const countryCallingCodes={
'United States':'+1','Canada':'+1','United Kingdom':'+44','Pakistan':'+92','United Arab Emirates':'+971','Saudi Arabia':'+966','Qatar':'+974','Germany':'+49','France':'+33','Italy':'+39','Spain':'+34','Netherlands':'+31','Belgium':'+32','Switzerland':'+41','Austria':'+43','Sweden':'+46','Norway':'+47','Denmark':'+45','Finland':'+358','Ireland':'+353','Portugal':'+351','Poland':'+48','Turkey':'+90','Australia':'+61','New Zealand':'+64','China':'+86','India':'+91','Bangladesh':'+880','Japan':'+81','South Korea':'+82','Singapore':'+65','Malaysia':'+60','South Africa':'+27','Nigeria':'+234','Egypt':'+20'
};
$$('form[data-web3forms]').forEach(form=>{
  const country=form.querySelector('[data-country-select]');
  const code=form.querySelector('[data-phone-code]');
  if(country&&code){
    const syncCode=()=>{const next=countryCallingCodes[country.value];if(next&&[...code.options].some(o=>o.value===next))code.value=next;};
    country.addEventListener('change',syncCode); syncCode();
  }
});

// V43 — realistic production window: target delivery cannot be sooner than 30 days.
function isoLocalDate(date){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}
$$('input[name="target_delivery_date"]').forEach(input=>{
  const minDate=new Date(); minDate.setHours(12,0,0,0); minDate.setDate(minDate.getDate()+30);
  input.min=isoLocalDate(minDate);
  input.title='Please choose a target delivery date at least 30 days from today.';
});

// V46 — global navigation search.
(()=>{
  const toggle=document.querySelector('[data-site-search-toggle]');
  const panel=document.querySelector('[data-site-search-panel]');
  const input=panel?.querySelector('[data-site-search-input]');
  if(!toggle||!panel)return;
  const setOpen=(open)=>{
    panel.classList.toggle('open',open);
    panel.setAttribute('aria-hidden',String(!open));
    toggle.setAttribute('aria-expanded',String(open));
    if(open) setTimeout(()=>input?.focus(),120);
  };
  toggle.addEventListener('click',()=>setOpen(!panel.classList.contains('open')));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('open')){setOpen(false);toggle.focus();}});
  document.addEventListener('click',e=>{
    if(panel.classList.contains('open')&&!panel.contains(e.target)&&!toggle.contains(e.target))setOpen(false);
  });
})();
