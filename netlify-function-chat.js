// netlify/functions/chat.js
// Proxy sicuro tra il widget frontend e Claude API.
// La ANTHROPIC_API_KEY e il MAKE_WEBHOOK_URL non vengono mai esposti al browser.
//
// Setup:
//   1. Vai su Netlify → Site settings → Environment variables
//   2. Aggiungi:
//      ANTHROPIC_API_KEY = sk-ant-...
//      MAKE_WEBHOOK_URL  = https://hook.eu1.make.com/...
//   3. Deploy — Netlify inietta le variabili a runtime, mai nel codice

const SYSTEM_PROMPT = require('./system-prompt');  // vedi prompts/system.md → convertito in JS

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { messages, today } = body;

  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages required' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const systemPrompt = today
    ? `Oggi è ${today}.\n\n${SYSTEM_PROMPT}`
    : SYSTEM_PROMPT;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages
      })
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return {
        statusCode: claudeRes.status,
        body: JSON.stringify({ error: err.error?.message || 'Claude API error' })
      };
    }

    const data = await claudeRes.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Empty response' }) };
    }

    // Se il modello ha emesso un JSON di prenotazione, inoltralo a Make.com
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.includes('"action":"booking"')) {
      const webhookUrl = process.env.MAKE_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          const booking = JSON.parse(trimmed);
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...booking, timestamp: new Date().toISOString() })
          });
        } catch (e) {
          console.warn('Webhook Make non raggiunto:', e.message);
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal error' })
    };
  }
};
