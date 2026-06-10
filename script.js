/* =========================================
   CONFIGURATION
   =========================================
   Hedef tarihi değiştirmek için yalnızca
   bu satırı güncelleyin:
   ========================================= */
const TARGET_DATE = new Date('2026-06-30T00:00:00');

/* Başlangıç tarihi (ilerleme çubuğu için) */
const START_DATE = new Date('2025-09-01T00:00:00');

/* Mesaj gösterim süresi (ms) */
const MESSAGE_DURATION = 20000;

/* =========================================
   STATE
   ========================================= */
let allMessages = [];       // Düzleştirilmiş mesaj listesi
let shuffledQueue = [];     // Mevcut döngü sırası
let currentIndex = 0;       // Sıradaki mesaj indeksi
let messageTimer = null;    // Otomatik geçiş zamanlayıcısı
let countdownTimer = null;  // Geri sayım zamanlayıcısı
let touchStartX = 0;        // Swipe başlangıcı

/* =========================================
   DOM REFERANSLARI
   ========================================= */
const $ = (id) => document.getElementById(id);

const elDays      = $('days');
const elHours     = $('hours');
const elMinutes   = $('minutes');
const elSeconds   = $('seconds');
const elCountdown = $('countdown');
const elCelebration   = $('celebration');
const elProgressFill  = $('progress-fill');
const elProgressLabel = $('progress-label');
const elCard          = $('message-card');
const elContent       = $('message-content');
const elText          = $('message-text');
const elAuthor        = $('message-author-name');
const elLoading       = $('message-loading');
const elError         = $('message-error');
const elEmpty         = $('message-empty');
const elTimerFill     = $('timer-fill');
const elBtnPrev       = $('btn-prev');
const elBtnNext       = $('btn-next');

/* =========================================
   GERİ SAYIM
   ========================================= */
function pad(n) {
  return String(Math.max(0, n)).padStart(2, '0');
}

function updateCountdown() {
  const now  = Date.now();
  const diff = TARGET_DATE.getTime() - now;

  if (diff <= 0) {
    // Süre doldu
    elCountdown.hidden = true;
    elCelebration.hidden = false;

    const progressBar = document.querySelector('.progress-section');
    if (progressBar) progressBar.hidden = true;

    clearInterval(countdownTimer);
    return;
  }

  const totalSecs = Math.floor(diff / 1000);
  const days    = Math.floor(totalSecs / 86400);
  const hours   = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  elDays.textContent    = pad(days);
  elHours.textContent   = pad(hours);
  elMinutes.textContent = pad(minutes);
  elSeconds.textContent = pad(seconds);

  // Erişilebilirlik: aria-valuenow (ilerleme çubuğunda güncellenir)
  updateProgress();
}

/* =========================================
   İLERLEME ÇUBUĞU
   ========================================= */
function updateProgress() {
  const total   = TARGET_DATE.getTime() - START_DATE.getTime();
  const elapsed = Date.now() - START_DATE.getTime();
  const pct     = Math.min(100, Math.max(0, (elapsed / total) * 100));

  elProgressFill.style.width = pct.toFixed(2) + '%';

  const track = elProgressFill.closest('[role="progressbar"]');
  if (track) track.setAttribute('aria-valuenow', Math.round(pct));

  elProgressLabel.textContent = pct.toFixed(1) + '% tamamlandı';
}

/* =========================================
   MESAJ SİSTEMİ — Yükleme
   ========================================= */
async function loadMessages() {
  try {
    const res  = await fetch('quotes.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    // Tüm mesajları düzleştir; her birine sahibin adını ekle
    const flat = [];
    for (const person of data) {
      for (const msg of person.messages) {
        flat.push({
          id:     msg.id,
          text:   msg.text,
          author: person.name,
          personId: person.id
        });
      }
    }

    if (flat.length === 0) {
      showState('empty');
      return;
    }

    allMessages = flat;
    initMessageQueue();
    showMessage(currentIndex);
    startMessageTimer();

  } catch (err) {
    console.error('Mesajlar yüklenemedi:', err);
    showState('error');
  }
}

/* =========================================
   MESAJ SİSTEMİ — Sıra (Random without repetition)
   ========================================= */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Aynı kişi arka arkaya gelmesin diye son elemanı kontrol et.
 * Eğer yeni dizinin başı önceki dizinin sonuyla aynı kişideyse swap yap.
 */
function buildQueue(lastPersonId) {
  let queue = shuffle(allMessages);

  if (lastPersonId !== undefined && queue.length > 1) {
    if (queue[0].personId === lastPersonId) {
      // İlk elemanı farklı bir kişiyle takas et
      const swapIdx = queue.findIndex((m) => m.personId !== lastPersonId);
      if (swapIdx !== -1) {
        [queue[0], queue[swapIdx]] = [queue[swapIdx], queue[0]];
      }
    }
  }

  return queue;
}

function initMessageQueue() {
  shuffledQueue = buildQueue();
  currentIndex  = 0;
}

function nextIndex() {
  currentIndex++;
  if (currentIndex >= shuffledQueue.length) {
    const lastPerson = shuffledQueue[shuffledQueue.length - 1].personId;
    shuffledQueue = buildQueue(lastPerson);
    currentIndex  = 0;
  }
}

function prevIndex() {
  currentIndex--;
  if (currentIndex < 0) {
    currentIndex = shuffledQueue.length - 1;
  }
}

/* =========================================
   MESAJ SİSTEMİ — Gösterim
   ========================================= */
function showState(state) {
  elLoading.hidden = state !== 'loading';
  elError.hidden   = state !== 'error';
  elEmpty.hidden   = state !== 'empty';
  elContent.hidden = state !== 'message';
}

function showMessage(idx) {
  const msg = shuffledQueue[idx];
  if (!msg) return;

  // Geçiş animasyonu
  elCard.classList.add('fade-out');

  setTimeout(() => {
    elText.textContent   = msg.text;
    elAuthor.textContent = msg.author;
    showState('message');

    elCard.classList.remove('fade-out');
    elCard.classList.add('fade-in');

    setTimeout(() => {
      elCard.classList.remove('fade-in');
    }, 400);

    resetTimerBar();
  }, 200);
}

/* =========================================
   MESAJ SİSTEMİ — Zamanlayıcı
   ========================================= */
function resetTimerBar() {
  // CSS animasyonunu yeniden başlat
  elTimerFill.style.animation = 'none';
  // Reflow tetikle
  void elTimerFill.offsetWidth;
  elTimerFill.style.animation = '';
}

function startMessageTimer() {
  clearTimeout(messageTimer);
  messageTimer = setTimeout(goNext, MESSAGE_DURATION);
}

function resetMessageTimer() {
  clearTimeout(messageTimer);
  startMessageTimer();
}

/* =========================================
   NAVİGASYON
   ========================================= */
function goNext() {
  if (allMessages.length === 0) return;
  nextIndex();
  showMessage(currentIndex);
  resetMessageTimer();
}

function goPrev() {
  if (allMessages.length === 0) return;
  prevIndex();
  showMessage(currentIndex);
  resetMessageTimer();
}

/* =========================================
   EVENT LİSTENERS
   ========================================= */
elBtnNext.addEventListener('click', goNext);
elBtnPrev.addEventListener('click', goPrev);

// Klavye desteği
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    goNext();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    goPrev();
  }
});

// Swipe desteği (mobil)
document.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].clientX;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) < 40) return; // Çok kısa swipe yoksay
  if (dx < 0) goNext();
  else goPrev();
}, { passive: true });

/* =========================================
   BAŞLATMA
   ========================================= */
function init() {
  // İlk geri sayım güncellemesini hemen yap
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);

  // Mesajları yükle
  loadMessages();
}

init();
