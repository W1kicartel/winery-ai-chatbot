# Winery AI Chatbot — Federico

Customer-facing AI assistant for a Campania winery. Handles product questions, cellar visit bookings, and e-commerce order flow from a single chat interface — embedded directly on the website.

**Status:** DEMO — Cantine Federiciane, Campania

---

## Problem

A family winery with a growing direct-sales channel had no way to handle customer questions outside business hours. Inquiries about wine pairings, visit availability, and shipping came in via email and Instagram DM — response time averaged 6–12h, and potential orders were lost overnight.

## Solution

**Federico** — a conversational AI agent embedded on the website that:
1. Answers product questions (varietals, tasting notes, pairings, vintages)
2. Handles cellar visit bookings (availability check + confirmation)
3. Guides customers through the purchase flow → Stripe Checkout
4. Escalates complex requests to the owner via email

---

## Architecture

```
Customer (website chat widget)
          │
          ▼
    Netlify Function
    (webhook handler)
          │
          ▼
     Claude API
   (system prompt:
   Federico persona +
   product catalog)
          │
    ┌─────┴──────────┐
    │                │
Make.com webhook   Stripe Checkout
(visit bookings)   (e-commerce)
    │
    ▼
Owner email notification
```

---

## Stack

| Component | Tool |
|---|---|
| Chat widget | Vanilla JS, embedded via script tag |
| Backend | Netlify Functions (Node.js) |
| AI | Claude API (claude-sonnet) |
| Booking orchestration | Make.com |
| Payments | Stripe Checkout |
| Hosting | Netlify |

---

## Features

- **Persistent persona** — Federico has a defined character: knowledgeable, warm, southern Italian. Not a generic assistant.
- **Product catalog in context** — full wine list, tasting notes, and pairing suggestions injected into system prompt
- **Visit booking** — checks availability via Make.com, confirms via email
- **Purchase handoff** — generates Stripe Checkout links for direct orders
- **Owner escalation** — detects requests outside scope and notifies via email
- **Language** — responds in Italian by default, handles English

---

## System Prompt Design

The core of Federico's behavior lives in `prompts/federico.md`. Key decisions:

- Product catalog injected as structured markdown (not a tool call) — keeps latency low
- Explicit escalation triggers defined: custom orders, large quantities, complaints
- Tone guide: uses "tu", avoids corporate language, references Campanian wine culture naturally

---

## Repo Structure

```
/
├── netlify/
│   └── functions/
│       └── chat.js            # Serverless handler → Claude API
├── widget/
│   ├── chat-widget.js         # Embeddable chat UI
│   └── chat-widget.css
├── prompts/
│   └── federico.md            # System prompt + product catalog
├── make-blueprint/
│   └── visit-booking.json     # Make.com scenario for visit bookings
└── docs/
    └── setup.md
```

---

## Setup

### Prerequisites
- Netlify account
- Anthropic API key
- Stripe account (for e-commerce)
- Make.com account (for visit bookings)

### Steps

1. Clone repo, `cd` into root
2. Set env vars in Netlify: `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`
3. Deploy to Netlify (`netlify deploy --prod`)
4. Embed widget on website: add `<script src="https://your-netlify-url/chat-widget.js">` before `</body>`
5. Import `make-blueprint/visit-booking.json` and configure email credentials

Full guide in [`docs/setup.md`](./docs/setup.md).

---

## Results

- Average response time: 6–12h → <5s
- After-hours inquiries handled autonomously: ~70%
- Cellar visit bookings via chat in first month: 12

---

## About

Built by [ME](https://github.com/w1kicartel) / [AIgentFlow](https://AIgentflow.cloud) — AI automation for Italian SMBs.
