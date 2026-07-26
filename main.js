/* ORIONAI — frontend logic
   1. Animated starfield / constellation canvas
   2. Chat wiring against /api/chat
   3. Scroll-reveal for sections
   Developed by Rashmith.
*/

/* ---------------- Starfield canvas ---------------- */
(function starfield() {
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  let w, h, stars, mouse = { x: 0, y: 0 };
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const density = Math.min(140, Math.floor((w * h) / 9000));
    stars = Array.from({ length: density }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.3,
      baseAlpha: Math.random() * 0.6 + 0.25,
      twinkleSpeed: Math.random() * 0.015 + 0.004,
      phase: Math.random() * Math.PI * 2,
      driftX: (Math.random() - 0.5) * 0.05,
      driftY: (Math.random() - 0.5) * 0.05,
    }));
  }

  // Orion's belt + shoulders/feet, normalized 0-1 coordinates
  const constellation = [
    { x: 0.30, y: 0.28 }, // Betelgeuse (shoulder)
    { x: 0.62, y: 0.24 }, // Bellatrix (shoulder)
    { x: 0.38, y: 0.48 }, // belt left
    { x: 0.47, y: 0.51 }, // belt mid
    { x: 0.56, y: 0.54 }, // belt right
    { x: 0.33, y: 0.78 }, // Saiph (foot)
    { x: 0.66, y: 0.74 }, // Rigel (foot)
  ];
  const constellationLines = [
    [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6],
  ];

  function drawConstellation(t) {
    const cx = w * 0.5, cy = h * 0.4;
    const scale = Math.min(w, h) * 0.55;
    const offsetX = (mouse.x - w / 2) * 0.01;
    const offsetY = (mouse.y - h / 2) * 0.01;

    const pts = constellation.map(p => ({
      x: cx + (p.x - 0.5) * scale + offsetX,
      y: cy + (p.y - 0.5) * scale + offsetY,
    }));

    ctx.save();
    ctx.strokeStyle = 'rgba(216,168,87,0.22)';
    ctx.lineWidth = 1;
    constellationLines.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    });

    pts.forEach((p, i) => {
      const pulse = 0.6 + Math.sin(t * 0.0012 + i) * 0.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6 + pulse * 1.6, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
      grad.addColorStop(0, `rgba(216,168,87,${0.9})`);
      grad.addColorStop(1, 'rgba(216,168,87,0)');
      ctx.fillStyle = grad;
      ctx.fill();
    });
    ctx.restore();
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);

    stars.forEach(s => {
      s.phase += s.twinkleSpeed;
      const alpha = s.baseAlpha * (0.6 + Math.sin(s.phase) * 0.4);
      s.x += s.driftX;
      s.y += s.driftY;
      if (s.x < 0) s.x = w; if (s.x > w) s.x = 0;
      if (s.y < 0) s.y = h; if (s.y > h) s.y = 0;

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(237,239,247,${alpha})`;
      ctx.fill();
    });

    drawConstellation(t);

    if (!prefersReduced) requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  resize();
  requestAnimationFrame(frame);
  if (prefersReduced) frame(0); // draw one static frame only
})();

/* ---------------- Scroll reveal ---------------- */
(function scrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach(el => io.observe(el));
})();

/* ---------------- Chat logic ---------------- */
(function chat() {
  const heroForm = document.getElementById('hero-form');
  const heroInput = document.getElementById('hero-input');
  const chatFrame = document.getElementById('chat-frame');
  const chatLog = document.getElementById('chat-log');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chips = document.querySelectorAll('.chip');

  let history = [];

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role === 'user' ? 'user' : 'orion'}`;
    div.textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
    return div;
  }

  function addTyping() {
    const div = document.createElement('div');
    div.className = 'msg orion typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
    return div;
  }

  async function sendMessage(text) {
    if (!text.trim()) return;

    if (chatFrame.hidden) {
      chatFrame.hidden = false;
      chatFrame.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    addMessage('user', text);
    history.push({ role: 'user', content: text });

    const typingEl = addTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
      });

      const data = await res.json();
      typingEl.remove();

      if (!res.ok) {
        addMessage('error', data.detail || 'Something went wrong reaching Orion.');
        return;
      }

      addMessage('orion', data.reply);
      history.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      typingEl.remove();
      addMessage('error', 'Network error — check that the backend is running.');
    }
  }

  heroForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = heroInput.value;
    heroInput.value = '';
    sendMessage(text);
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value;
    chatInput.value = '';
    sendMessage(text);
  });

  chips.forEach(chip => {
    chip.addEventListener('click', () => sendMessage(chip.dataset.q));
  });
})();
