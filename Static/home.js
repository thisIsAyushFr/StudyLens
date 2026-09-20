const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =========================================================
   Minimal spring — press feedback. Interruptible: press again
   before the release-bounce settles and it just re-targets.
   ========================================================= */
class Spring {
    constructor({ from = 1, dampingRatio = 1, response = 0.3, onUpdate } = {}) {
        this.value = from;
        this.target = from;
        this.velocity = 0;
        this.onUpdate = onUpdate;
        this.setPhysics(dampingRatio, response);
        this._raf = null;
        this._last = null;
    }
    setPhysics(d, r) {
        const w = (2 * Math.PI) / Math.max(r, 0.01);
        this.stiffness = w * w;
        this.damping = 2 * d * w;
    }
    retarget(to) {
        this.target = to;
        if (!this._raf) { this._last = performance.now(); this._raf = requestAnimationFrame(this._tick.bind(this)); }
    }
    _tick(now) {
        const dt = Math.min((now - this._last) / 1000, 1 / 30);
        this._last = now;
        const disp = this.value - this.target;
        const acc = -this.stiffness * disp - this.damping * this.velocity;
        this.velocity += acc * dt;
        this.value += this.velocity * dt;
        this.onUpdate && this.onUpdate(this.value);
        if (Math.abs(this.velocity) < 0.003 && Math.abs(disp) < 0.003) {
            this.value = this.target;
            this.onUpdate && this.onUpdate(this.value);
            this._raf = null;
            return;
        }
        this._raf = requestAnimationFrame(this._tick.bind(this));
    }
}

function makePressable(el, { pressScale = 0.95 } = {}) {
    if (!el) return;
    if (prefersReducedMotion) {
        el.addEventListener('pointerdown', () => (el.style.opacity = '0.75'));
        ['pointerup', 'pointerleave'].forEach((e) => el.addEventListener(e, () => (el.style.opacity = '')));
        return;
    }
    const spring = new Spring({ from: 1, onUpdate: (v) => el.style.setProperty('--press-scale', v.toFixed(4)) });
    el.addEventListener('pointerdown', () => { spring.setPhysics(1, 0.12); spring.retarget(pressScale); });
    const release = () => { spring.setPhysics(0.7, 0.28); spring.retarget(1); };
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => el.addEventListener(e, release));
}
document.querySelectorAll('.pressable').forEach((el) => makePressable(el));

/* =========================================================
   Magnetic buttons — the CTA leans toward the pointer within
   a radius, springs back to center on leave. Tracks the pointer
   1:1 while active; a real spring settles it on release, so a
   fast re-enter just redirects mid-flight instead of snapping.
   ========================================================= */
if (!prefersReducedMotion) {
    document.querySelectorAll('.magnetic').forEach((el) => {
        const springX = new Spring({ from: 0, dampingRatio: 0.6, response: 0.35, onUpdate: (v) => el.style.setProperty('--mx', `${v}px`) });
        const springY = new Spring({ from: 0, dampingRatio: 0.6, response: 0.35, onUpdate: (v) => el.style.setProperty('--my', `${v}px`) });
        el.style.transform = 'translate(var(--mx, 0px), var(--my, 0px)) scale(var(--press-scale, 1))';
        el.addEventListener('pointermove', (e) => {
            const rect = el.getBoundingClientRect();
            const relX = e.clientX - (rect.left + rect.width / 2);
            const relY = e.clientY - (rect.top + rect.height / 2);
            springX.retarget(relX * 0.28);
            springY.retarget(relY * 0.28);
        });
        el.addEventListener('pointerleave', () => { springX.retarget(0); springY.retarget(0); });
    });
}

/* =========================================================
   Hero demo — highlight the source line, type the question,
   reveal the sourced answer. Runs once in view, replayable.
   ========================================================= */
const QUESTION = "what do mitochondria actually do?";
const ANSWER = "They produce most of the cell's ATP, through a process called oxidative phosphorylation.";

const hlPhrase = document.getElementById('hlPhrase');
const typedQuestion = document.getElementById('typedQuestion');
const caret = document.getElementById('caret');
const demoAnswer = document.getElementById('demoAnswer');
const answerText = document.getElementById('answerText');
const heroDemo = document.getElementById('heroDemo');
const replayBtn = document.getElementById('replayBtn');

let demoRunning = false;
let demoTimeouts = [];
const clearDemoTimers = () => { demoTimeouts.forEach(clearTimeout); demoTimeouts = []; };

function resetDemo() {
    clearDemoTimers();
    hlPhrase.classList.remove('lit');
    typedQuestion.textContent = '';
    answerText.textContent = '';
    demoAnswer.classList.remove('shown');
    caret.classList.remove('hidden');
}

function typeInto(el, text, speed, onDone) {
    let i = 0;
    function step() {
        el.textContent = text.slice(0, i);
        i++;
        if (i <= text.length) demoTimeouts.push(setTimeout(step, speed));
        else if (onDone) onDone();
    }
    step();
}

function runDemo() {
    if (demoRunning) return;
    demoRunning = true;
    resetDemo();

    if (prefersReducedMotion) {
        hlPhrase.classList.add('lit');
        typedQuestion.textContent = QUESTION;
        caret.classList.add('hidden');
        answerText.textContent = ANSWER;
        demoAnswer.classList.add('shown');
        demoRunning = false;
        return;
    }

    demoTimeouts.push(setTimeout(() => hlPhrase.classList.add('lit'), 300));
    demoTimeouts.push(setTimeout(() => {
        typeInto(typedQuestion, QUESTION, 28, () => {
            demoTimeouts.push(setTimeout(() => {
                caret.classList.add('hidden');
                answerText.textContent = ANSWER;
                demoAnswer.classList.add('shown');
                demoRunning = false;
            }, 350));
        });
    }, 1100));
}

const demoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) { runDemo(); demoObserver.disconnect(); }
    });
}, { threshold: 0.5 });
if (heroDemo) demoObserver.observe(heroDemo);

replayBtn.addEventListener('click', () => { demoRunning = false; runDemo(); });

/* =========================================================
   Scroll to section
   ========================================================= */
document.getElementById('scrollToHow').addEventListener('click', () => {
    document.getElementById('how').scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
});

/* =========================================================
   Stat count-up — runs once when the block enters view
   ========================================================= */
const statCount = document.getElementById('statCount');
const TARGET = 40000;

function formatCount(n) {
    return Math.round(n).toLocaleString('en-US');
}

function runStatCount() {
    if (prefersReducedMotion) { statCount.textContent = formatCount(TARGET); return; }
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        statCount.textContent = formatCount(TARGET * eased);
        if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

const statObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) { runStatCount(); statObserver.disconnect(); }
    });
}, { threshold: 0.6 });
if (statCount) statObserver.observe(document.querySelector('.stat'));

/* =========================================================
   FAQ accordion — height spring so it can be reopened mid-close
   ========================================================= */
document.querySelectorAll('.faq-item').forEach((item) => {
    const btn = item.querySelector('.faq-q');
    const answer = item.querySelector('.faq-a');
    btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach((other) => {
            if (other !== item) {
                other.classList.remove('open');
                other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
                other.querySelector('.faq-a').style.maxHeight = '0px';
            }
        });
        if (isOpen) {
            item.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
            answer.style.maxHeight = '0px';
        } else {
            item.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
            answer.style.maxHeight = `${answer.scrollHeight}px`;
        }
    });
});
