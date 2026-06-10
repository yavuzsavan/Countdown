/**
 * script.js
 * ---------
 * 1. Geri sayımı başlatır ve her saniye günceller.
 * 2. quotes.json dosyasından mesajları Fetch API ile çeker.
 * 3. Mesajları kart olarak DOM'a ekler.
 * 4. Hata ve boş durum mesajlarını yönetir.
 */

/* ─────────────────────────────────────────
   AYARLAR — gerekirse buradan düzenle
───────────────────────────────────────── */

/** Geri sayım hedef tarihi (yerel saat: 30 Haziran 2026 00:00:00) */
const TARGET_DATE = new Date('2026-06-30T00:00:00');

/** Mesaj JSON dosyasının yolu (index.html ile aynı klasörde) */
const QUOTES_FILE = 'quotes.json';

/* ─────────────────────────────────────────
   GERİ SAYIM
───────────────────────────────────────── */

/**
 * Bir sayıyı 2 haneli string'e çevirir.
 * @param {number} n
 * @returns {string}
 */
function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

/** DOM referansları */
const domDays    = document.getElementById('days');
const domHours   = document.getElementById('hours');
const domMinutes = document.getElementById('minutes');
const domSeconds = document.getElementById('seconds');
const domBoard   = document.getElementById('countdownBoard');
const domCelebration = document.getElementById('celebration');

/** Önceki değerleri saklayarak sadece değişen haneleri günceller */
const prevValues = { days: '', hours: '', minutes: '', seconds: '' };

/** Geri sayımı hesaplar ve DOM'u günceller */
function updateCountdown() {
  const now  = new Date();
  const diff = TARGET_DATE - now;   /* milisaniye fark */

  /* Süre doldu */
  if (diff <= 0) {
    domBoard.hidden = true;
    domCelebration.hidden = false;
    return; /* interval'i durdurmaya gerek yok, gereksiz işlem olmaz */
  }

  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);

  const newValues = {
    days:    pad(d),
    hours:   pad(h),
    minutes: pad(m),
    seconds: pad(s),
  };

  /* Sadece değişen elemanı güncelle — gereksiz DOM yazımını önler */
  if (newValues.days    !== prevValues.days)    { domDays.textContent    = newValues.days;    prevValues.days    = newValues.days;    }
  if (newValues.hours   !== prevValues.hours)   { domHours.textContent   = newValues.hours;   prevValues.hours   = newValues.hours;   }
  if (newValues.minutes !== prevValues.minutes) { domMinutes.textContent = newValues.minutes; prevValues.minutes = newValues.minutes; }
  if (newValues.seconds !== prevValues.seconds) { domSeconds.textContent = newValues.seconds; prevValues.seconds = newValues.seconds; }
}

/* İlk çağrı — sayfa açılır açılmaz değerleri göster */
updateCountdown();

/* Sonraki çağrıları bir sonraki tam saniyeye hizala (daha az sürüklenme) */
const msUntilNextSecond = 1000 - (Date.now() % 1000);
setTimeout(() => {
  updateCountdown();
  setInterval(updateCountdown, 1000);
}, msUntilNextSecond);

/* ─────────────────────────────────────────
   MESAJLAR — FETCH
───────────────────────────────────────── */

/** DOM referansları */
const domLoading  = document.getElementById('stateLoading');
const domError    = document.getElementById('stateError');
const domEmpty    = document.getElementById('stateEmpty');
const domGrid     = document.getElementById('cardsGrid');
const domRetry    = document.getElementById('retryBtn');

/**
 * Bir string'i HTML'de güvenli şekilde göstermek için escape eder.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/**
 * Bir kişinin adından baş harflerini üretir (en fazla 2).
 * Örn: "Ahmet Yılmaz" → "AY"
 * @param {string} name
 * @returns {string}
 */
function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Tek bir mesaj kartı DOM elemanı oluşturur.
 * @param {{ name: string, quote: string }} item
 * @returns {HTMLElement}
 */
function createCard(item) {
  const article = document.createElement('article');
  article.className = 'card';
  article.setAttribute('tabindex', '0'); /* klavye ile ulaşılabilir */

  article.innerHTML = `
    <span class="card-quote-mark" aria-hidden="true">"</span>
    <p class="card-text">${escapeHtml(item.quote)}</p>
    <div class="card-author">
      <div class="card-avatar" aria-hidden="true">${escapeHtml(initials(item.name))}</div>
      <span class="card-name">${escapeHtml(item.name)}</span>
    </div>
  `;

  return article;
}

/**
 * Durum elemanlarını sıfırlar (hepsini gizler).
 */
function resetStates() {
  domLoading.hidden = true;
  domError.hidden   = true;
  domEmpty.hidden   = true;
  domGrid.innerHTML = '';
}

/**
 * quotes.json dosyasını çeker ve kartları oluşturur.
 */
async function loadQuotes() {
  resetStates();
  domLoading.hidden = false;

  try {
    const response = await fetch(QUOTES_FILE);

    /* HTTP hata kontrolü (404, 500 vb.) */
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    domLoading.hidden = true;

    /* Boş dizi kontrolü */
    if (!Array.isArray(data) || data.length === 0) {
      domEmpty.hidden = false;
      return;
    }

    /* Geçerli girişleri filtrele ve kartları oluştur */
    const fragment = document.createDocumentFragment();

    data.forEach(item => {
      /* Her iki alan da dolu olmalı */
      if (
        item &&
        typeof item.name  === 'string' && item.name.trim()  !== '' &&
        typeof item.quote === 'string' && item.quote.trim() !== ''
      ) {
        fragment.appendChild(createCard(item));
      }
    });

    if (fragment.childElementCount === 0) {
      domEmpty.hidden = false;
      return;
    }

    domGrid.appendChild(fragment);

  } catch (err) {
    /* Hata durumu — konsola da yaz */
    console.error('[quotes] Yüklenemedi:', err);
    domLoading.hidden = true;
    domError.hidden   = false;
  }
}

/* Tekrar Dene butonu */
domRetry.addEventListener('click', loadQuotes);

/* Sayfa hazır olunca mesajları yükle */
loadQuotes();
