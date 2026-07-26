const HISTORY_KEY = 'orionai:history';

(function starfield() {
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  let w, h, stars;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const density = Math.min(110, Math.floor((w * h) / 11000));
    stars = Array.from({ length: density }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.3 + 0.3,
      baseAlpha: Math.random() * 0.55 + 0.2,
      twinkleSpeed: Math.random() * 0.015 + 0.004,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    stars.forEach(s => {
      s.phase += s.twinkleSpeed;
      const alpha = s.baseAlpha * (0.6 + Math.sin(s.phase) * 0.4);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(237,239,247,${alpha})`;
      ctx.fill();
    });
    if (!prefersReduced) requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
  if (prefersReduced) frame();
})();

(function chat() {
  const emptyState = document.getElementById('empty-state');
  const messagesEl = document.getElementById('messages');
  const chatScroll = document.getElementById('chat-scroll');
  const form = document.getElementById('composer-form');
  const input = document.getElementById('composer-input');
  const submitBtn = form.querySelector('.composer-submit');
  const newChatBtn = document.getElementById('new-chat-btn');
  const chips = document.querySelectorAll('.chip');

  const attachBtn = document.getElementById('attach-btn');
  const imageInput = document.getElementById('image-input');
  const imagePreview = document.getElementById('image-preview');
  const imagePreviewImg = document.getElementById('image-preview-img');
  const imageRemoveBtn = document.getElementById('image-remove-btn');

  const micBtn = document.getElementById('mic-btn');

  let history = loadHistory();
  let pendingImage = null;

  renderAll();

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  }

  function scrollToBottom() {
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }

  function renderAll() {
    messagesEl.innerHTML = '';
    if (history.length === 0) {
      emptyState.style.display = 'flex';
      return;
    }
    emptyState.style.display = 'none';
    history.forEach(turn => appendBubble(turn.role, turn.content, false));
    scrollToBottom();
  }

  function appendBubble(role, text, animate = true) {
    const row = document.createElement('div');
    row.className = `msg-row ${role === 'user' ? 'user' : 'orion'}`;
    if (!animate) row.style.animation = 'none';

    const label = document.createElement('div');
    label.className = 'msg-label';
    label.innerHTML = role === 'user' ? 'You' : '<span class="dot"></span> Orion';

    const bubbleRow = document.createElement('div');
    bubbleRow.className = 'bubble-row';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    bubbleRow.appendChild(bubble);

    if (role !== 'user') {
      const speakBtn = document.createElement('button');
      speakBtn.type = 'button';
      speakBtn.className = 'speak-btn';
      speakBtn.title = 'Read aloud';
      speakBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 8a5 5 0 0 1 0 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      speakBtn.addEventListener('click', () => toggleSpeak(text, speakBtn));
      bubbleRow.appendChild(speakBtn);
    }

    row.appendChild(label);
    row.appendChild(bubbleRow);
    messagesEl.appendChild(row);
    return { row, bubble };
  }

  function appendUserImageBubble(text, dataUrl) {
    const row = document.createElement('div');
    row.className = 'msg-row user';
    const label = document.createElement('div');
    label.className = 'msg-label';
    label.textContent = 'You';
    const bubbleRow = document.createElement('div');
    bubbleRow.className = 'bubble-row';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'bubble-image';
    bubble.appendChild(img);
    if (text) bubble.appendChild(document.createTextNode(text));
    bubbleRow.appendChild(bubble);
    row.appendChild(label);
    row.appendChild(bubbleRow);
    messagesEl.appendChild(row);
  }

  function appendTyping() {
    const row = document.createElement('div');
    row.className = 'msg-row orion typing-row';
    row.innerHTML = `
      <div class="msg-label"><span class="dot"></span> Orion</div>
      <div class="bubble-row"><div class="bubble"><span></span><span></span><span></span></div></div>
    `;
    messagesEl.appendChild(row);
    scrollToBottom();
    return row;
  }

  attachBtn.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      pendingImage = { base64, mime: file.type, dataUrl };
      imagePreviewImg.src = dataUrl;
      imagePreview.hidden = false;
    };
    reader.readAsDataURL(file);
  });

  imageRemoveBtn.addEventListener('click', () => {
    pendingImage = null;
    imageInput.value = '';
    imagePreview.hidden = true;
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  let listening = false;

  if (SpeechRecognition) {
    recognizer = new SpeechRecognition();
    recognizer.continuous = false;
    recognizer.interimResults = true;
    recognizer.lang = 'en-US';

    recognizer.addEventListener('result', (e) => {
      let transcript = '';
      for (const result of e.results) transcript += result[0].transcript;
      input.value = transcript;
    });
    recognizer.addEventListener('end', () => {
      listening = false;
      micBtn.classList.remove('listening');
    });
    recognizer.addEventListener('error', () => {
      listening = false;
      micBtn.classList.remove('listening');
    });

    micBtn.addEventListener('click', () => {
      if (listening) {
        recognizer.stop();
        return;
      }
      try {
        recognizer.start();
        listening = true;
        micBtn.classList.add('listening');
      } catch {}
    });
  } else {
    micBtn.style.display = 'none';
  }

  let currentUtterance = null;
  function toggleSpeak(text, btn) {
    if (!('speechSynthesis' in window)) return;

    if (currentUtterance && speechSynthesis.speaking) {
      speechSynthesis.cancel();
      document.querySelectorAll('.speak-btn.speaking').forEach(b => b.classList.remove('speaking'));
      if (currentUtterance._btn === btn) { currentUtterance = null; return; }
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter._btn = btn;
    utter.rate = 1;
    utter.onstart = () => btn.classList.add('speaking');
    utter.onend = () => { btn.classList.remove('speaking'); currentUtterance = null; };
    utter.onerror = () => { btn.classList.remove('speaking'); currentUtterance = null; };
    currentUtterance = utter;
    speechSynthesis.speak(utter);
  }

  async function sendMessage(text) {
    text = text.trim();
    const hasImage = !!pendingImage;
    if (!text && !hasImage) return;

    if (history.length === 0) emptyState.style.display = 'none';

    if (hasImage) {
      appendUserImageBubble(text, pendingImage.dataUrl);
    } else {
      appendBubble('user', text);
    }
    history.push({ role: 'user', content: text || '(sent an image)' });
    saveHistory();
    scrollToBottom();

    const imageForRequest = pendingImage;
    input.value = '';
    pendingImage = null;
    imageInput.value = '';
    imagePreview.hidden = true;
    submitBtn.disabled = true;

    const typingRow = appendTyping();

    try {
      const body = { message: text, history: history.slice(0, -1) };
      if (imageForRequest) {
        body.image = imageForRequest.base64;
        body.image_mime = imageForRequest.mime;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      typingRow.remove();

      if (!res.ok) {
        const { bubble } = appendBubble('orion', data.detail || 'Something went wrong reaching Orion.');
        bubble.classList.add('error');
        scrollToBottom();
        return;
      }

      appendBubble('orion', data.reply);
      history.push({ role: 'assistant', content: data.reply });
      saveHistory();
      scrollToBottom();
    } catch (err) {
      typingRow.remove();
      const { bubble } = appendBubble('orion', 'Network error — check that the backend is running.');
      bubble.classList.add('error');
      scrollToBottom();
    } finally {
      submitBtn.disabled = false;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });

  chips.forEach(chip => {
    chip.addEventListener('click', () => sendMessage(chip.dataset.q));
  });

  newChatBtn.addEventListener('click', () => {
    history = [];
    saveHistory();
    pendingImage = null;
    imagePreview.hidden = true;
    if (speechSynthesis.speaking) speechSynthesis.cancel();
    renderAll();
    input.focus();
  });
})();
