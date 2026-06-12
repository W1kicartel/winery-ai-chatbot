// ===== AI CHATBOT WIDGET =====
// Widget conversazionale con integrazione Claude API via Netlify Function.
//
// SETUP:
//   1. Deploya netlify/functions/chat.js sul tuo sito Netlify
//   2. Imposta ANTHROPIC_API_KEY e MAKE_WEBHOOK_URL nelle env vars di Netlify
//   3. Incolla questo script prima di </body>:
//      <script src="/widget/chat-widget.js"></script>

const CHATBOT_CONFIG = {
  // Endpoint Netlify Function — API key mai esposta al browser
  CHAT_ENDPOINT: '/.netlify/functions/chat',
  MAX_TOKENS: 1024
};

// Il system prompt viene iniettato dalla Netlify Function (vedi prompts/system.md)
// Il webhook Make.com viene chiamato dalla Netlify Function (env var MAKE_WEBHOOK_URL)

let chatMessages = [];
let chatIsOpen = false;
let chatIsTyping = false;

const CHAT_FALLBACK = {
  greeting: "Buongiorno! Come posso aiutarla?",
  error: "Connessione momentaneamente assente. La preghiamo di riprovare o di contattarci direttamente."
};

// ===== GESTIONE RISPOSTA BOT =====
async function handleBotResponse(rawText) {
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') && trimmed.includes('"action":"booking"')) {
    try {
      const booking = JSON.parse(trimmed);
      // La Netlify Function si occupa di inviare il payload a Make.com
      const conferma = `Perfetto ${booking.nome}! Ho registrato la sua prenotazione per l'esperienza ${booking.esperienza} (${booking.prezzo}/persona) il ${booking.data.split(' ')[0]} per ${booking.partecipanti} ${booking.partecipanti === '1' ? 'persona' : 'persone'}. Riceverà una conferma a ${booking.email}.`;
      addChatMessage('bot', conferma);
      chatMessages.push({ role: 'assistant', content: conferma });
      return;
    } catch (e) {
      // JSON malformato, mostra risposta grezza
    }
  }
  addChatMessage('bot', rawText);
  chatMessages.push({ role: 'assistant', content: rawText });
}

// ===== INIZIALIZZAZIONE =====
(function initChat() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', chatSetup);
  } else {
    chatSetup();
  }
})();

function chatSetup() {
  injectChatStyles();
  injectChatHTML();
  setupChatEvents();
}

// ===== STILI =====
function injectChatStyles() {
  const style = document.createElement('style');
  style.id = 'chatbot-styles';
  style.textContent = `
    #chat-bubble {
      position: fixed; bottom: 24px; right: 24px;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #c99a3c, #d4a853);
      border: none; cursor: pointer; z-index: 90;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 24px rgba(201,154,60,0.35);
      transition: all 0.3s ease;
      animation: chatPulse 3s ease-in-out infinite;
    }
    #chat-bubble:hover { transform: scale(1.1); box-shadow: 0 6px 30px rgba(201,154,60,0.5); animation: none; }
    #chat-bubble svg { width: 28px; height: 28px; color: #1a1410; }
    @keyframes chatPulse {
      0%,100% { box-shadow: 0 4px 24px rgba(201,154,60,0.35); }
      50% { box-shadow: 0 4px 36px rgba(201,154,60,0.55); }
    }
    #chat-window {
      position: fixed; bottom: 96px; right: 24px;
      width: 380px; height: 540px; border-radius: 12px;
      background: #0d0a07; border: 1px solid rgba(201,154,60,0.2);
      z-index: 91; display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 12px 48px rgba(0,0,0,0.6);
      opacity: 0; transform: scale(0.92) translateY(20px); pointer-events: none;
      transition: all 0.35s cubic-bezier(0.25,0.46,0.45,0.94);
      font-family: 'Inter', system-ui, sans-serif;
    }
    #chat-window.open { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }
    .chat-header {
      background: linear-gradient(135deg, #1a1410, #3d2a16);
      border-bottom: 1px solid rgba(201,154,60,0.2);
      padding: 16px 20px; display: flex; align-items: center;
      justify-content: space-between; flex-shrink: 0;
    }
    .chat-header-info { display: flex; align-items: center; gap: 12px; }
    .chat-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #c99a3c, #d4a853);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .chat-avatar svg { width: 20px; height: 20px; color: #1a1410; }
    .chat-header-text h3 {
      font-family: 'Cormorant Garamond', serif;
      color: #f0e6d8; font-size: 18px; font-weight: 600; margin: 0; line-height: 1.2;
    }
    .chat-header-text p { color: #c99a3c; font-size: 11px; margin: 0; letter-spacing: 0.05em; }
    .chat-close {
      background: none; border: none; color: #c99a3c; cursor: pointer;
      padding: 10px; border-radius: 4px; transition: all 0.2s;
      display: flex; align-items: center; justify-content: center;
      min-width: 44px; min-height: 44px;
    }
    .chat-close:hover { color: #e8c876; background: rgba(201,154,60,0.15); }
    .chat-messages {
      flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
      padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #0d0a07;
    }
    .chat-messages::-webkit-scrollbar { width: 4px; }
    .chat-messages::-webkit-scrollbar-thumb { background: #3d2a16; border-radius: 2px; }
    .chat-msg { display: flex; gap: 8px; max-width: 85%; animation: chatMsgIn 0.3s ease-out; }
    .chat-msg.bot { align-self: flex-start; }
    .chat-msg.user { align-self: flex-end; flex-direction: row-reverse; }
    .chat-msg-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 2px;
    }
    .chat-msg.bot .chat-msg-avatar { background: linear-gradient(135deg, #c99a3c, #d4a853); }
    .chat-msg.bot .chat-msg-avatar svg { width: 14px; height: 14px; color: #1a1410; }
    .chat-msg.user .chat-msg-avatar { background: #3d2a16; }
    .chat-msg.user .chat-msg-avatar svg { width: 14px; height: 14px; color: #c9a97a; }
    .chat-msg-bubble {
      padding: 10px 14px; border-radius: 8px;
      font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
    }
    .chat-msg.bot .chat-msg-bubble {
      background: #1a1410; border: 1px solid rgba(201,154,60,0.12);
      color: #e0ccaf; border-top-left-radius: 2px;
    }
    .chat-msg.user .chat-msg-bubble {
      background: linear-gradient(135deg, #c99a3c, #b8862d);
      color: #1a1410; border-top-right-radius: 2px; font-weight: 500;
    }
    .chat-typing { display: flex; gap: 4px; padding: 4px 0; align-items: center; }
    .chat-typing-dot { width: 7px; height: 7px; border-radius: 50%; background: #c99a3c; opacity: 0.4; }
    .chat-typing-dot:nth-child(1) { animation: chatTypingDot 1.2s ease-in-out infinite 0s; }
    .chat-typing-dot:nth-child(2) { animation: chatTypingDot 1.2s ease-in-out infinite 0.2s; }
    .chat-typing-dot:nth-child(3) { animation: chatTypingDot 1.2s ease-in-out infinite 0.4s; }
    @keyframes chatTypingDot {
      0%,60%,100% { opacity: 0.4; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-4px); }
    }
    @keyframes chatMsgIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .chat-input-area {
      padding: 12px 16px; border-top: 1px solid rgba(201,154,60,0.15);
      display: flex; gap: 8px; background: #1a1410; flex-shrink: 0;
    }
    .chat-input {
      flex: 1; background: #0d0a07; border: 1px solid #3d2a16;
      border-radius: 6px; padding: 10px 14px; color: #f0e6d8;
      font-size: 16px; font-family: 'Inter', system-ui, sans-serif;
      outline: none; transition: border-color 0.2s;
    }
    .chat-input::placeholder { color: #5e3f1f; }
    .chat-input:focus { border-color: rgba(201,154,60,0.4); }
    .chat-input:disabled { opacity: 0.5; }
    .chat-send {
      width: 44px; height: 44px; border-radius: 6px;
      background: linear-gradient(135deg, #c99a3c, #b8862d);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; flex-shrink: 0;
    }
    .chat-send:hover { background: linear-gradient(135deg, #d4a853, #c99a3c); }
    .chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
    .chat-send svg { width: 18px; height: 18px; color: #1a1410; }
    .chat-suggestions {
      display: flex; gap: 6px; padding: 0 16px 12px;
      background: #0d0a07; overflow-x: auto;
      -webkit-overflow-scrolling: touch; scrollbar-width: none;
      flex-wrap: nowrap; flex-shrink: 0;
    }
    .chat-suggestions::-webkit-scrollbar { display: none; }
    .chat-suggestion {
      background: rgba(201,154,60,0.08); border: 1px solid rgba(201,154,60,0.25);
      border-radius: 16px; padding: 6px 12px; color: #c99a3c;
      font-size: 12px; cursor: pointer; transition: all 0.2s;
      font-family: 'Inter', system-ui, sans-serif; white-space: nowrap; flex-shrink: 0;
    }
    .chat-suggestion:hover { background: rgba(201,154,60,0.15); border-color: #c99a3c; }
    @media (max-width: 480px) {
      #chat-bubble { bottom: 20px; right: 16px; width: 52px; height: 52px; }
      #chat-bubble svg { width: 24px; height: 24px; }
      #chat-window {
        bottom: 0 !important; right: 0 !important; left: 0 !important;
        width: 100% !important; height: 100dvh !important;
        border-radius: 0 !important; border-left: none !important;
        border-right: none !important; border-bottom: none !important;
      }
      .chat-header { padding: 14px 16px; padding-top: max(14px, env(safe-area-inset-top)); }
      .chat-msg-bubble { font-size: 14px; }
      .chat-input-area { padding: 10px 12px; padding-bottom: max(10px, env(safe-area-inset-bottom)); }
    }
  `;
  document.head.appendChild(style);
}

// ===== HTML =====
function injectChatHTML() {
  const wineIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10l-2 8a5 5 0 0 1-3 3.5V18h2v2H10v-2h2v-4.5A5 5 0 0 1 9 10L7 2z"/></svg>';
  const closeIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const sendIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="14"/><polygon points="22 2 15 22 11 14 2 10 22 2"/></svg>';
  const userIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  const bubble = document.createElement('button');
  bubble.id = 'chat-bubble';
  bubble.setAttribute('aria-label', 'Apri chat assistente');
  bubble.innerHTML = wineIconSVG;
  document.body.appendChild(bubble);

  const win = document.createElement('div');
  win.id = 'chat-window';
  win.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-info">
        <div class="chat-avatar">${wineIconSVG}</div>
        <div class="chat-header-text">
          <h3>Assistente</h3>
          <p>Sono qui per aiutarti</p>
        </div>
      </div>
      <button class="chat-close" aria-label="Chiudi chat">${closeIconSVG}</button>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    <div class="chat-suggestions" id="chat-suggestions">
      <button class="chat-suggestion" data-msg="Parlami dei prodotti">I Nostri Prodotti</button>
      <button class="chat-suggestion" data-msg="Voglio prenotare una visita">Prenota Visita</button>
      <button class="chat-suggestion" data-msg="Come vi contatto?">Contatti</button>
      <button class="chat-suggestion" data-msg="Richiesta commerciale B2B">B2B</button>
    </div>
    <div class="chat-input-area">
      <input type="text" class="chat-input" id="chat-input" placeholder="Scrivi un messaggio..." autocomplete="off">
      <button class="chat-send" id="chat-send" aria-label="Invia">${sendIconSVG}</button>
    </div>
  `;
  document.body.appendChild(win);
  addChatMessage('bot', CHAT_FALLBACK.greeting);
}

// ===== EVENTI =====
function setupChatEvents() {
  const bubble = document.getElementById('chat-bubble');
  const win = document.getElementById('chat-window');
  const closeBtn = win.querySelector('.chat-close');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const suggestions = document.getElementById('chat-suggestions');

  bubble.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);
  sendBtn.addEventListener('click', handleChatSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
  });
  suggestions.addEventListener('click', (e) => {
    const btn = e.target.closest('.chat-suggestion');
    if (btn) { input.value = btn.dataset.msg; handleChatSend(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatIsOpen) closeChat();
  });
}

function openChat() {
  chatIsOpen = true;
  document.getElementById('chat-window').classList.add('open');
  document.getElementById('chat-bubble').style.animation = 'none';
  setTimeout(() => document.getElementById('chat-input').focus(), 350);
  scrollToBottom();
}

function closeChat() {
  chatIsOpen = false;
  document.getElementById('chat-window').classList.remove('open');
  document.getElementById('chat-bubble').style.animation = 'chatPulse 3s ease-in-out infinite';
}

// ===== UI HELPERS =====
function addChatMessage(role, text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const wineIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10l-2 8a5 5 0 0 1-3 3.5V18h2v2H10v-2h2v-4.5A5 5 0 0 1 9 10L7 2z"/></svg>';
  const userIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${role}`;
  msgDiv.innerHTML = `
    <div class="chat-msg-avatar">${role === 'bot' ? wineIconSVG : userIconSVG}</div>
    <div class="chat-msg-bubble">${escapeHTML(text)}</div>
  `;
  container.appendChild(msgDiv);
  scrollToBottom();
  if (role === 'user') {
    const suggestions = document.getElementById('chat-suggestions');
    if (suggestions) suggestions.style.display = 'none';
  }
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const wineIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10l-2 8a5 5 0 0 1-3 3.5V18h2v2H10v-2h2v-4.5A5 5 0 0 1 9 10L7 2z"/></svg>';
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-msg bot';
  msgDiv.id = 'chat-typing-msg';
  msgDiv.innerHTML = `
    <div class="chat-msg-avatar">${wineIconSVG}</div>
    <div class="chat-msg-bubble">
      <div class="chat-typing">
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(msgDiv);
  scrollToBottom();
}

function hideTyping() {
  const t = document.getElementById('chat-typing-msg');
  if (t) t.remove();
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== SEND =====
async function handleChatSend() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const text = input.value.trim();
  if (!text || chatIsTyping) return;

  addChatMessage('user', text);
  chatMessages.push({ role: 'user', content: text });
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  chatIsTyping = true;
  showTyping();

  try {
    const response = await callChatAPI(chatMessages);
    hideTyping();
    await handleBotResponse(response);
  } catch (error) {
    hideTyping();
    addChatMessage('bot', CHAT_FALLBACK.error);
  } finally {
    chatIsTyping = false;
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
    scrollToBottom();
  }
}

// ===== API CALL (via Netlify Function — API key mai esposta al browser) =====
async function callChatAPI(messages) {
  const oggi = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const response = await fetch(CHATBOT_CONFIG.CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      today: oggi
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.content) throw new Error('Risposta vuota');
  return data.content;
}
