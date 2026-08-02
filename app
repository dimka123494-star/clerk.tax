/* ============================================================
   clerk.tax — спільний скрипт
   Ключ Supabase уже вписано. Це публічний anon key — він і має
   бути видимим у коді; доступ обмежується політиками RLS у Supabase.
   ============================================================ */
const CFG = {
  SUPABASE_URL: 'https://rhduokjaawmorcyiuviy.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoZHVva2phYXdtb3JjeWl1dml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDE1NDgsImV4cCI6MjA5NjQxNzU0OH0.usjLWtdJW0OJt8dgUfCnkVljKN6kpG7vJ907Y_XWieg',
  TABLE: 'leads',
  SOURCE: 'clerk.tax',
  STAGE: 'Новий лід',
  AW_ID: 'AW-18171698074',
  PHONE: '+380931104662',
  FALLBACK_EMAIL: 'custom@forwardcarua.com'
};

/* ---------- FAQ ---------- */
function toggleFaq(btn){
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if(!isOpen) item.classList.add('open');
}

/* ---------- Навігація ---------- */
function toggleDrawer(){
  const d = document.getElementById('nav-drawer');
  const b = document.getElementById('nav-burger');
  const open = d.classList.toggle('open');
  b.classList.toggle('open', open);
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeDrawer(){
  const d = document.getElementById('nav-drawer');
  const b = document.getElementById('nav-burger');
  if(d) d.classList.remove('open');
  if(b){ b.classList.remove('open'); b.setAttribute('aria-expanded','false'); }
  document.body.style.overflow = '';
}

/* ---------- Аналітика ---------- */
function trackCall(){
  if(typeof gtag === 'function') gtag('event','phone_click',{event_category:'contact'});
}
function trackLead(service){
  if(typeof gtag === 'function'){
    gtag('event','conversion',{send_to: CFG.AW_ID});
    gtag('event','generate_lead',{event_category:'form', event_label: service || '', value:1, currency:'UAH'});
  }
}

/* ---------- Прокрутка до форми + підстановка послуги ---------- */
function goToForm(service){
  if(service){
    const sel = document.getElementById('f-service');
    if(sel){
      const match = [...sel.options].find(o => o.text === service);
      if(match) sel.value = match.value || match.text;
    }
  }
  const target = document.getElementById('contact') || document.getElementById('lead-form');
  if(target) target.scrollIntoView({behavior:'smooth'});
}
function pickPlan(planName){
  const msg = document.getElementById('f-msg');
  if(msg && !msg.value) msg.value = 'Цікавить тариф: ' + planName;
  goToForm();
}

/* ---------- UTM / gclid ---------- */
function getUtm(){
  const p = new URLSearchParams(location.search);
  const keys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid'];
  const out = {};
  keys.forEach(k => { const v = p.get(k); if(v) out[k] = v; });
  if(document.referrer && !document.referrer.includes(location.hostname)) out.referrer = document.referrer;
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

/* ---------- Відправка заявки ---------- */
function initLeadForm(){
  const form = document.getElementById('lead-form');
  if(!form) return;

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const btn  = document.getElementById('cf-btn');
    const box  = document.getElementById('cf-msg');
    const name = document.getElementById('f-name');
    const phone= document.getElementById('f-phone');

    box.className = 'cf-msg';
    box.textContent = '';
    [name, phone].forEach(el => el.classList.remove('invalid'));

    let bad = false;
    if(!name.value.trim()){ name.classList.add('invalid'); bad = true; }
    if(phone.value.replace(/\D/g,'').length < 9){ phone.classList.add('invalid'); bad = true; }
    if(bad){
      box.className = 'cf-msg err';
      box.textContent = 'Вкажіть імʼя та коректний номер телефону.';
      return;
    }

    // Пастка для ботів
    const hp = document.getElementById('f-company-hp');
    if(hp && hp.value){
      box.className = 'cf-msg ok';
      box.textContent = 'Дякуємо! Заявку прийнято.';
      return;
    }

    const bizEl = document.getElementById('f-biz');
    const msgEl = document.getElementById('f-msg');
    const svcEl = document.getElementById('f-service');
    const pageTag = form.dataset.page || document.title;

    const payload = {
      name:   name.value.trim(),
      phone:  phone.value.trim(),
      email:  (document.getElementById('f-email')?.value || '').trim() || null,
      service: svcEl ? svcEl.value : 'Бухгалтерський облік',
      notes: [
        bizEl ? 'Тип бізнесу: ' + bizEl.value : '',
        'Сторінка: ' + pageTag,
        msgEl ? msgEl.value.trim() : ''
      ].filter(Boolean).join('\n'),
      source: CFG.SOURCE,
      stage:  CFG.STAGE,
      utm:    getUtm()
    };

    btn.disabled = true;
    btn.textContent = 'Надсилаємо…';

    try{
      const res = await fetch(CFG.SUPABASE_URL + '/rest/v1/' + CFG.TABLE, {
        method: 'POST',
        headers: {
          'apikey': CFG.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + CFG.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error(res.status + ' ' + await res.text());

      trackLead(payload.service);
      form.querySelectorAll('input, textarea').forEach(el => el.value = '');
      btn.textContent = 'Надіслано ✓';
      btn.style.background = 'var(--gold)';
      btn.style.color = 'var(--navy)';
      box.className = 'cf-msg ok';
      box.textContent = 'Дякуємо! Заявку отримано — зателефонуємо протягом 30 хвилин у робочий час.';
    }catch(err){
      console.error('Lead submit failed:', err);
      btn.disabled = false;
      btn.textContent = 'Надіслати заявку';
      box.className = 'cf-msg err';
      box.innerHTML = 'Не вдалося надіслати заявку. Зателефонуйте <a href="tel:' + CFG.PHONE + '" style="color:inherit">+38 093 110-46-62</a> або напишіть на <a href="mailto:' + CFG.FALLBACK_EMAIL + '" style="color:inherit">' + CFG.FALLBACK_EMAIL + '</a>.';
    }
  });
}

/* ---------- Ховання шапки при скролі ---------- */
function initNavScroll(){
  const nav = document.getElementById('main-nav');
  if(!nav) return;
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.style.transform = (y > lastY && y > 60) ? 'translateY(-100%)' : 'translateY(0)';
    lastY = y;
  }, {passive:true});
}

document.addEventListener('DOMContentLoaded', function(){
  initLeadForm();
  initNavScroll();
});
