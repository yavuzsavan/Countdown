/* ============================================================
   CONFIGURATION — change only this line to update the target date
   ============================================================ */
const TARGET_DATE = new Date('2026-06-30T00:00:00');

/* ============================================================
   COUNTDOWN
   ============================================================ */
(function initCountdown() {
  const els = {
    days:    document.getElementById('days'),
    hours:   document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
    countdown:   document.getElementById('countdown'),
    celebration: document.getElementById('celebration'),
  };

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const now  = Date.now();
    const diff = TARGET_DATE.getTime() - now;

    if (diff <= 0) {
      // Show celebration, hide countdown
      els.countdown.hidden   = true;
      els.celebration.hidden = false;
      return; // stop ticking
    }

    const totalSec = Math.floor(diff / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600)  / 60);
    const s = totalSec % 60;

    els.days.textContent    = pad(d);
    els.hours.textContent   = pad(h);
    els.minutes.textContent = pad(m);
    els.seconds.textContent = pad(s);

    setTimeout(tick, 1000 - (Date.now() % 1000)); // sync to wall clock
  }

  tick();
})();

/* ============================================================
   QUOTE SYSTEM
   ============================================================ */
(function initQuotes() {
  /* ---- DOM refs ---- */
  const quoteCard    = document.getElementById('quote-card');
  const quoteInner   = document.getElementById('quote-inner');
  const quoteText    = document.getElementById('quote-text');
  const quoteAuthor  = document.getElementById('quote-author');
  const quoteError   = document.getElementById('quote-error');
  const quoteEmpty   = document.getElementById('quote-empty');
  const btnPrev      = document.getElementById('btn-prev');
  const btnNext      = document.getElementById('btn-next');
  const msgCounter   = document.getElementById('message-counter');

  /* ---- State ---- */
  let pool       = [];   // flat list: { text, name }
  let shuffled   = [];   // current shuffled order (indices into pool)
  let cursor     = 0;    // position in shuffled
  let autoTimer  = null;
  const AUTO_DELAY = 20000; // 20 s

  /* ---- Fisher-Yates shuffle ---- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Avoid same author back-to-back at wrap seam */
  function buildShuffled(prevLastName) {
    let attempt = shuffle([...Array(pool.length).keys()]);
    // Simple guard: if first item shares author with prevLastName, swap with second
    if (
      prevLastName &&
      pool[attempt[0]].name === prevLastName &&
      attempt.length > 1
    ) {
      [attempt[0], attempt[1]] = [attempt[1], attempt[0]];
    }
    return attempt;
  }

  /* ---- Display ---- */
  function showMessage(idx) {
    const msg = pool[idx];

    // fade out
    quoteInner.classList.add('fade-out');

    setTimeout(() => {
      quoteText.textContent   = msg.text;
      quoteAuthor.textContent = msg.name;
      msgCounter.textContent  = `${cursor + 1} / ${pool.length}`;

      // prepare fade-in
      quoteInner.classList.remove('fade-out');
      quoteInner.classList.add('fade-in');

      // trigger reflow so transition fires
      void quoteInner.offsetWidth;

      quoteInner.classList.remove('fade-in');
    }, 220);
  }

  function advance(direction) {
    resetTimer();

    if (direction === 1) {
      cursor++;
      if (cursor >= shuffled.length) {
        // new cycle — avoid same author at seam
        const prevLastName = pool[shuffled[shuffled.length - 1]].name;
        shuffled = buildShuffled(prevLastName);
        cursor   = 0;
      }
    } else {
      cursor--;
      if (cursor < 0) cursor = shuffled.length - 1;
    }

    showMessage(shuffled[cursor]);
    startTimer();
  }

  function startTimer() {
    autoTimer = setTimeout(() => advance(1), AUTO_DELAY);
  }

  function resetTimer() {
    clearTimeout(autoTimer);
    autoTimer = null;
  }

  /* ---- Initialise with data ---- */
  function init(data) {
    // Build flat message pool
    data.forEach(person => {
      if (!Array.isArray(person.messages)) return;
      person.messages.forEach(msg => {
        pool.push({ text: msg.text, name: person.name });
      });
    });

    if (pool.length === 0) {
      quoteEmpty.hidden = false;
      quoteInner.hidden = true;
      return;
    }

    shuffled = buildShuffled(null);

    // Random starting position
    cursor = Math.floor(Math.random() * shuffled.length);

    showMessage(shuffled[cursor]);
    startTimer();
  }

  /* ---- Button events ---- */
  btnPrev.addEventListener('click', () => advance(-1));
  btnNext.addEventListener('click', () => advance(1));

  /* ---- Keyboard ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  { e.preventDefault(); advance(1);  }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')    { e.preventDefault(); advance(-1); }
  });

  /* ---- Touch / swipe ---- */
  let touchStartX = 0;
  let touchStartY = 0;

  quoteCard.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
  }, { passive: true });

  quoteCard.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      advance(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  /* ---- Load data ---- */
  fetch('quotes.json')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => init(data))
    .catch(err => {
      console.error('quotes.json yüklenemedi:', err);
      quoteText.textContent  = '';
      quoteAuthor.textContent = '';
      quoteError.hidden = false;
    });
})();
