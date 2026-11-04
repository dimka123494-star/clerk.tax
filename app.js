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
  if(typeof gtag === 'function'){
    gtag('event','conversion',{send_to: CFG.AW_ID + '/5GutCNnZ26UdEJq3-NhD'});
    gtag('event','phone_click',{event_category:'contact'});
  }
}
function trackLead(service){
  if(typeof gtag === 'function'){
    gtag('event','conversion',{send_to: CFG.AW_ID + '/K4vRCNbZ26UdEJq3-NhD'});
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
async function sendLead(payload){
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
}

/* ---------- Тип бізнесу за замовчуванням за сторінкою ---------- */
function initBizDefault(){
  const sel = document.getElementById('f-biz'); if(!sel) return;
  const path = location.pathname;
  const pick = re => { const o = [...sel.options].find(o => re.test(o.text)); if(o) sel.value = o.value || o.text; };
  if(/fop/.test(path)) pick(/3 група/);
  else if(/reyestratsiya/.test(path)) pick(/Ще не/);
  else if(/tov|dia-city|zarplat|podatkove|vidnovlennya|yurydych/.test(path)) pick(/^ТОВ/);
}

/* ---------- Велика форма: зайві поля ховаємо під «Додати деталі» ---------- */
function initFormDetails(){
  const form = document.getElementById('lead-form'); if(!form) return;
  const groups = ['f-email','f-biz','f-service','f-msg'].map(id => { const el = document.getElementById(id); return el && el.closest('.cf-g'); }).filter(Boolean);
  if(!groups.length) return;
  const det = document.createElement('details'); det.className = 'cf-more';
  det.innerHTML = '<summary>Додати деталі <span>(необовʼязково)</span></summary><div class="cf-more-body"></div>';
  groups[0].parentNode.insertBefore(det, groups[0]);
  groups.forEach(g => det.querySelector('.cf-more-body').appendChild(g));
  const msg = document.getElementById('f-msg');
  if(msg && msg.value) det.open = true;
}

/* ---------- Коротка форма одразу під першим екраном ---------- */
function initQuickForm(){
  const big = document.getElementById('lead-form'); if(!big) return;
  const hero = document.querySelector('header.page-hero, #hero'); if(!hero) return;
  const sec = document.createElement('section'); sec.className = 'qf-band'; sec.id = 'quick-form';
  sec.innerHTML = '<div class="qf-inner"><div class="qf-text"><b>Розрахуємо вартість за 30 хвилин</b><span>Залиште номер — бухгалтер передзвонить у робочий час. Консультація безкоштовна.</span></div>' +
    '<form class="qf-form" novalidate><input type="text" name="qf-name" autocomplete="name" placeholder="Ваше імʼя" aria-label="Ваше імʼя">' +
    '<input type="tel" name="qf-phone" autocomplete="tel" placeholder="+380 __ ___ __ __" aria-label="Телефон">' +
    '<button type="submit">Отримати розрахунок</button></form><div class="qf-msg" role="status" aria-live="polite"></div>' +
    '<div class="qf-alt">або напишіть: <a href="https://t.me/Dimakrykun95" target="_blank" rel="noopener">Telegram</a> · <a href="viber://chat?number=%2B380931104662">Viber</a> · <a href="tel:' + CFG.PHONE + '" onclick="trackCall()">' + '+38 093 110-46-62' + '</a></div></div>';
  hero.parentNode.insertBefore(sec, hero.nextSibling);
  const f = sec.querySelector('form'), msg = sec.querySelector('.qf-msg'), btn = f.querySelector('button');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const name = f.elements['qf-name'], phone = f.elements['qf-phone'];
    [name, phone].forEach(el => el.classList.remove('invalid'));
    let bad = false;
    if(!name.value.trim()){ name.classList.add('invalid'); bad = true; }
    if(phone.value.replace(/\D/g,'').length < 9){ phone.classList.add('invalid'); bad = true; }
    if(bad){ msg.className = 'qf-msg err'; msg.textContent = 'Вкажіть імʼя та номер телефону.'; return; }
    const svc = document.getElementById('f-service');
    const biz = document.getElementById('f-biz');
    const payload = { name: name.value.trim(), phone: phone.value.trim(), email: null,
      service: svc ? svc.value : 'Бухгалтерський облік',
      notes: ['Швидка форма', biz ? 'Тип бізнесу (за сторінкою): ' + biz.value : '', 'Сторінка: ' + (big.dataset.page || document.title)].filter(Boolean).join('\n'),
      source: CFG.SOURCE, stage: CFG.STAGE, utm: getUtm() };
    btn.disabled = true; btn.textContent = 'Надсилаємо…';
    try{
      await sendLead(payload);
      trackLead(payload.service);
      f.style.display = 'none';
      msg.className = 'qf-msg ok'; msg.textContent = 'Дякуємо! Заявку отримано — зателефонуємо протягом 30 хвилин у робочий час.';
    }catch(err){
      console.error('Quick lead failed:', err);
      btn.disabled = false; btn.textContent = 'Отримати розрахунок';
      msg.className = 'qf-msg err';
      msg.innerHTML = 'Не вдалося надіслати. Зателефонуйте <a href="tel:' + CFG.PHONE + '">+38 093 110-46-62</a> або напишіть у <a href="https://t.me/Dimakrykun95" target="_blank" rel="noopener">Telegram</a>.';
    }
  });
}

/* ---------- Таблиці цін на телефоні: підписи стовпців для карток ---------- */
function initTables(){
  document.querySelectorAll('table.ptable').forEach(t => {
    const heads = [...t.querySelectorAll('thead th, tr:first-child th')].map(th => th.textContent.trim());
    if(!heads.length) return;
    t.classList.add('ptable-cards');
    t.querySelectorAll('tbody tr, tr').forEach(tr => [...tr.children].forEach((td, i) => { if(td.tagName === 'TD' && heads[i]) td.setAttribute('data-label', heads[i]); }));
  });
}
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

    // Пастка для ботів: не відкидаємо (браузерне автозаповнення теж може її заповнити), а позначаємо
    const hp = document.getElementById('f-hpx') || document.getElementById('f-company-hp');
    const botFlag = hp && hp.value ? '⚠ Можливо бот: заповнене приховане поле' : '';

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
        botFlag,
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
      await sendLead(payload);

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
  initBizDefault();
  initFormDetails();
  initQuickForm();
  initTables();
  initNavScroll();
});

/* ---------- Конверсія «Контакт» для месенджерів ---------- */
document.addEventListener('click', function(e){
  var a = e.target.closest && e.target.closest('a[href]');
  if(!a) return;
  var h = a.getAttribute('href') || '';
  if(/^(https:\/\/t\.me|viber:|https:\/\/wa\.me|https:\/\/api\.whatsapp)/i.test(h) && typeof gtag === 'function'){
    gtag('event','conversion',{send_to: CFG.AW_ID + '/5GutCNnZ26UdEJq3-NhD'});
  }
});
