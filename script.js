/**
 * ════════════════════════════════════════════════
 *  Tekamüle Geçiş İmtihanı — script.js
 *  ─────────────────────────────────────────────
 *  Tasarım ilkeleri (mühendislik perspektifi):
 *
 *  1. SINGLE SOURCE OF TRUTH (CONFIG nesnesi)
 *     Tüm ayarlar tek yerde; hiçbir sihirli sayı
 *     kod içine gömülmez.
 *
 *  2. STATE MAKİNESİ
 *     Mesaj sistemi açık durumlarla yönetilir:
 *     loading → ready | error | empty
 *     Gelecekte yeni durum eklemek önemsizdir.
 *
 *  3. BELLEK SIZDIRMAMA
 *     setInterval / setTimeout referansları
 *     saklanır ve clearInterval/clearTimeout ile
 *     temizlenir.  Sayfa görünmez olduğunda
 *     (Page Visibility API) zamanlayıcılar durur;
 *     geri döndüğünde devam eder.
 *     → TV'de uzun süre açık kalabilir.
 *
 *  4. GENİŞLEYEBİLİR VERİ YAPISI
 *     FlatMessage tipine yeni alan eklemek
 *     sadece loadMessages() içinde bir satırdır.
 *
 *  5. ERİŞİLEBİLİRLİK
 *     Klavye, swipe, aria-valuenow güncellemesi.
 * ════════════════════════════════════════════════
 */

/* ────────────────────────────────────────────────
   YAPILANDIRMA  ← değiştirilmesi gereken tek yer
──────────────────────────────────────────────── */
const CONFIG = Object.freeze({
  /** Hedef tarih: sadece bu satırı güncelleyin */
  targetDate: new Date('2026-06-30T00:00:00'),

  /**
   * Başlangıç tarihi — ilerleme çubuğu için.
   * Değiştirmek isterseniz burayı güncelleyin.
   */
  startDate: new Date('2025-09-01T00:00:00'),

  /** Her mesajın ekranda kalma süresi (ms) */
  messageDuration: 20_000,

  /** Mesaj geçiş animasyonu süresi (ms) */
  fadeOutMs: 200,

  /** Swipe için minimum piksel mesafesi */
  swipeThreshold: 40,
});

/* ────────────────────────────────────────────────
   DURUM (STATE)
──────────────────────────────────────────────── */
const state = {
  /** @type {'loading'|'ready'|'error'|'empty'} */
  phase: 'loading',

  /** Düzleştirilmiş mesaj listesi (FlatMessage[]) */
  messages: [],

  /** Mevcut döngü sırası */
  queue: [],

  /** Sıradaki mesaj indeksi */
  index: 0,

  /** Zamanlayıcı handle'ları */
  timers: {
    countdown: null,
    message:   null,
  },

  /** Swipe başlangıç X */
  touchStartX: 0,

  /** Sayfa gizlendiğinde mesaj zamanlayıcısı duraklatıldı mı */
  messagePaused: false,

  /** Duraklatıldığında kalan süre (ms) */
  messageRemaining: CONFIG.messageDuration,

  /** Mesaj zamanlayıcısı son başlatıldığında */
  messageStartedAt: 0,
};

/* ────────────────────────────────────────────────
   DOM REFERANSLARI
   getElementById null döndürürse hata yutulur;
   eksik element tüm uygulamayı kilitlemez.
──────────────────────────────────────────────── */
const el = (() => {
  const ids = [
    'days','hours','minutes','seconds',
    'countdown','celebration',
    'progress-fill',
    'message-card','message-content',
    'message-text','message-author-name',
    'message-loading','message-error','message-empty',
    'timer-fill',
    'btn-prev','btn-next',
  ];
  return Object.fromEntries(
    ids.map(id => [id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
                   document.getElementById(id)])
  );
})();

/* ────────────────────────────────────────────────
   YARDIMCI FONKSİYONLAR
──────────────────────────────────────────────── */

/** İki haneli format */
const pad = n => String(Math.max(0, n)).padStart(2, '0');

/**
 * Fisher-Yates karıştırma — orijinal diziyi değiştirmez.
 * @param {any[]} arr
 * @returns {any[]}
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Kuyruğu oluşturur.
 * Son kişiyle aynı kişinin başa gelmesini engeller.
 * @param {number|undefined} lastPersonId
 * @returns {FlatMessage[]}
 */
function buildQueue(lastPersonId) {
  let q = shuffle(state.messages);
  if (lastPersonId !== undefined && q.length > 1 && q[0].personId === lastPersonId) {
    const swapAt = q.findIndex(m => m.personId !== lastPersonId);
    if (swapAt !== -1) [q[0], q[swapAt]] = [q[swapAt], q[0]];
  }
  return q;
}

/* ────────────────────────────────────────────────
   GERİ SAYIM
──────────────────────────────────────────────── */
function updateCountdown() {
  const diff = CONFIG.targetDate.getTime() - Date.now();

  if (diff <= 0) {
    if (el.countdown)    el.countdown.hidden = true;
    if (el.celebration)  el.celebration.hidden = false;
    const progressSec = document.querySelector('.progress-section');
    if (progressSec)     progressSec.hidden = true;
    clearInterval(state.timers.countdown);
    return;
  }

  const totalSecs = Math.floor(diff / 1000);
  if (el.days)    el.days.textContent    = pad(Math.floor(totalSecs / 86400));
  if (el.hours)   el.hours.textContent   = pad(Math.floor((totalSecs % 86400) / 3600));
  if (el.minutes) el.minutes.textContent = pad(Math.floor((totalSecs % 3600) / 60));
  if (el.seconds) el.seconds.textContent = pad(totalSecs % 60);

  updateProgress();
}

/* ────────────────────────────────────────────────
   İLERLEME ÇUBUĞU
──────────────────────────────────────────────── */
function updateProgress() {
  const total   = CONFIG.targetDate - CONFIG.startDate;
  const elapsed = Date.now() - CONFIG.startDate;
  const pct     = Math.min(100, Math.max(0, (elapsed / total) * 100));

  if (el.progressFill) el.progressFill.style.width = pct.toFixed(2) + '%';

  const track = el.progressFill?.closest('[role="progressbar"]');
  if (track) track.setAttribute('aria-valuenow', Math.round(pct));
}

/* ────────────────────────────────────────────────
   MESAJ SİSTEMİ — VERİ KATMANI
──────────────────────────────────────────────── */

/**
 * @typedef {{ id: number, text: string, author: string, personId: number }} FlatMessage
 */

async function loadMessages() {
  try {
    const res = await fetch('quotes.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    /** @type {FlatMessage[]} */
    const flat = [];
    for (const person of data) {
      for (const msg of person.messages) {
        flat.push({
          id:       msg.id,
          text:     msg.text,
          author:   person.name,
          personId: person.id,
          /* Gelecek sürümler için alan yerleri:
             avatar:    person.avatar ?? null,
             category:  msg.category ?? null,
             date:      msg.date ?? null,
          */
        });
      }
    }

    if (flat.length === 0) { setPhase('empty'); return; }

    state.messages = flat;
    state.queue    = buildQueue();
    state.index    = 0;

    setPhase('ready');
    renderMessage();
    scheduleNextMessage(CONFIG.messageDuration);

  } catch (err) {
    console.error('[loadMessages]', err);
    setPhase('error');
  }
}

/* ────────────────────────────────────────────────
   MESAJ SİSTEMİ — GÖRÜNÜM KATMANI
──────────────────────────────────────────────── */

/**
 * Uygulama fazını günceller; ilgili DOM öğelerini gösterir/gizler.
 * @param {'loading'|'ready'|'error'|'empty'} phase
 */
function setPhase(phase) {
  state.phase = phase;
  if (el.messageLoading) el.messageLoading.hidden = phase !== 'loading';
  if (el.messageError)   el.messageError.hidden   = phase !== 'error';
  if (el.messageEmpty)   el.messageEmpty.hidden   = phase !== 'empty';
  if (el.messageContent) el.messageContent.hidden = phase !== 'ready';
}

/** Mevcut mesajı animasyonla gösterir */
function renderMessage() {
  const msg = state.queue[state.index];
  if (!msg || !el.messageCard) return;

  el.messageCard.classList.add('fade-out');

  setTimeout(() => {
    if (el.messageText)       el.messageText.textContent   = msg.text;
    if (el.messageAuthorName) el.messageAuthorName.textContent = msg.author;

    el.messageCard.classList.remove('fade-out');
    el.messageCard.classList.add('fade-in');

    setTimeout(() => el.messageCard.classList.remove('fade-in'), 400);

    restartTimerBar();
  }, CONFIG.fadeOutMs);
}

/** CSS animasyonunu sıfırlayarak yeniden başlatır */
function restartTimerBar() {
  if (!el.timerFill) return;
  el.timerFill.style.animation = 'none';
  void el.timerFill.offsetWidth; // reflow tetikle
  el.timerFill.style.animation  = '';
}

/* ────────────────────────────────────────────────
   MESAJ SİSTEMİ — NAVİGASYON KATMANI
──────────────────────────────────────────────── */

/** İlerle */
function goNext() {
  if (state.phase !== 'ready') return;
  state.index++;
  if (state.index >= state.queue.length) {
    const lastPersonId = state.queue[state.queue.length - 1]?.personId;
    state.queue = buildQueue(lastPersonId);
    state.index = 0;
  }
  renderMessage();
  scheduleNextMessage(CONFIG.messageDuration);
}

/** Geri dön */
function goPrev() {
  if (state.phase !== 'ready') return;
  state.index = (state.index - 1 + state.queue.length) % state.queue.length;
  renderMessage();
  scheduleNextMessage(CONFIG.messageDuration);
}

/* ────────────────────────────────────────────────
   ZAMANLAYICI YÖNETİMİ
   Page Visibility API ile TV/uyku optimizasyonu
──────────────────────────────────────────────── */

function scheduleNextMessage(delayMs) {
  clearTimeout(state.timers.message);
  state.messageRemaining  = delayMs;
  state.messageStartedAt  = Date.now();
  state.messagePaused     = false;
  state.timers.message = setTimeout(goNext, delayMs);
}

function pauseMessageTimer() {
  if (state.messagePaused || state.phase !== 'ready') return;
  clearTimeout(state.timers.message);
  state.messageRemaining -= (Date.now() - state.messageStartedAt);
  state.messagePaused = true;
}

function resumeMessageTimer() {
  if (!state.messagePaused || state.phase !== 'ready') return;
  scheduleNextMessage(Math.max(0, state.messageRemaining));
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseMessageTimer();
  } else {
    resumeMessageTimer();
  }
});

/* ────────────────────────────────────────────────
   OLAY DİNLEYİCİLERİ
──────────────────────────────────────────────── */

el.btnNext?.addEventListener('click', goNext);
el.btnPrev?.addEventListener('click', goPrev);

// Klavye
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
});

// Swipe (mobil)
document.addEventListener('touchstart', e => {
  state.touchStartX = e.changedTouches[0].clientX;
}, { passive: true });

document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - state.touchStartX;
  if (Math.abs(dx) < CONFIG.swipeThreshold) return;
  dx < 0 ? goNext() : goPrev();
}, { passive: true });

/* ────────────────────────────────────────────────
   BAŞLATMA
──────────────────────────────────────────────── */
function init() {
  updateCountdown();
  state.timers.countdown = setInterval(updateCountdown, 1000);
  loadMessages();
}

init();
