<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Specification for First Generation Cloudflare-Hosted AI Chat Interface


***

## Project Overview

Build a **Cloudflare Workers-based AI web chat interface** using **TypeScript** and the **free-tier Cloudflare tools** where possible. The app will provide:

- A simple, accessible web UI via Workers Sites
- Chat interaction with various Cloudflare AI models via Workers AI APIs
- Ability to plug in external MCP servers (including Cloudflare MCP) for model integration
- Persistent storage of user configuration and chat history within Cloudflare
- Extendable to paid tiers if necessary for scaling or advanced features

The project will use **wrangler** for local development and deploy.

***

## 1. Technology Stack

| Component | Tool / Product | Notes |
| :-- | :-- | :-- |
| Language | TypeScript | Preferred for Cloudflare Workers |
| Hosting | Cloudflare Workers + Workers Sites | Free-tier supports lightweight hosting |
| Persistent Storage | Cloudflare KV + Durable Objects (initially KV) | KV for config, lightweight history; Durable Objects later if needed |
| Database Option | Cloudflare D1 (free tier) | Optional upgrade for complex history |
| AI Models | Cloudflare Workers AI | Use free API quotas as available |
| External MCP | HTTP fetch-proxy through Workers | Securely proxy requests |
| Secrets | Cloudflare Secrets Environment Vars | Store API keys and sensitive data |
| Frontend Framework | Vanilla JS/TS or lightweight framework | Minimal to reduce complexity |


***

## 2. Architecture Overview

### 2.1 Frontend

- Served from Workers Sites
- Single-page app (SPA) in TypeScript
- Connects to backend endpoints on same Workers domain for:
    - Sending chat messages / receiving responses
    - Configuring model/MCP details
    - Fetching chat history


### 2.2 Backend

- Cloudflare Worker endpoints to:
    - Handle chat input, route to AI models or to MCP servers
    - Persist user config and chat logs into KV (or Durable Objects in future)
    - Manage secrets securely via environment variables
- Proxy external MCP server API requests with HTTP fetch inside Workers

***

## 3. API Endpoints (handled by Worker)

| Path | Method | Purpose | Authentication |
| :-- | :-- | :-- | :-- |
| `/api/chat` | POST | Send chat prompt, receive AI (Cloudflare or MCP) replies | Per-user auth token or session cookie (optional in v1) |
| `/api/config` | GET/PUT | Read or update user config: selected models, MCP URLs | Same as above |
| `/api/history` | GET | Fetch user's chat history | Same as above |


***

## 4. Data Storage Strategy

| Data | Storage | Reasoning | Initial Free Tier Quota Considerations |
| :-- | :-- | :-- | :-- |
| User Configuration | Cloudflare KV | Simple key-value pairs (models, MCP endpoints, UI prefs, non-secret data) | KV free tier covers small, infrequent reads/writes |
| Chat History | Cloudflare KV (initial) | Append-only logs stored per user key | Limited size, fallback to pruning old records |
| Secret Tokens/Keys | Cloudflare Secrets | Encrypted environment vars, only editable by deploy | Free and secure |
| Advanced Chat History | Durable Objects (future upgrade) | Consistent and stateful storage for large history | Might require paid tier or optimized usage |


***

## 5. Security

- Store sensitive tokens as environment secrets, not in KV or frontend.
- Validate and sanitize all user input to avoid injection or abuse.
- Use HTTPS only; Workers enforce SSL by default.
- Optionally implement user auth/session tokens to isolate configs/history.
- MCP server communication to be secured with API keys or tokens (stored as secrets).

***

## 6. Development Setup

1. Install Wrangler CLI: `npm install -g wrangler`
2. Setup new Worker project with TypeScript: `npm create cloudflare@latest my-ai-chat`
3. Enable `KV Namespace` binding in `wrangler.toml` for config and history.
4. Define Cloudflare Secrets for AI API keys and MCP endpoints.
5. Develop frontend using vanilla TypeScript or minimal framework (optional: React/Preact).
6. Write endpoints inside Worker for chat, config, history.
7. Use `wrangler dev` for local testing, `wrangler deploy` for production.

***

## 7. Implementation Details

### 7.1 Handling Chat POST Request (`/api/chat`)

- Receive message + user/session ID + selected model or MCP endpoint reference
- If Cloudflare AI model, call Workers AI API with prompt
- If MCP server, proxy request with fetch
- Return AI response to frontend
- Save message + response in user chat history in KV


### 7.2 Handling Config GET/PUT (`/api/config`)

- GET: return stored user config from KV
- PUT: update user config with allowed fields only


### 7.3 Handling History GET (`/api/history`)

- Return chat history logs for user from KV


### 7.4 Frontend UI

- Input textbox for chat
- Dropdown or radio buttons to select AI Model or MCP endpoint
- Chat window showing conversation history
- Config UI to add/remove MCP server URLs, and choose models
- Responsive and minimal UI

***

## 8. Expansion Options (Paid or Future Versions)

- Use Durable Objects for better chat history and concurrent writes.
- Upgrade to Cloudflare D1 for relational history search and analytics.
- Add user authentication and multi-user support.
- Enable realtime updates via Durable Objects event listeners or WebSockets.
- Increase AI usage quota with paid Cloudflare Worker AI or 3rd party APIs.
- Persist secrets encrypted in KV or external Secrets Manager if dynamic secrets required.

***

## 9. Deliverables Checklist for a Dumb AI Coder

- [ ] Setup wrangler project with TypeScript and KV namespace
- [ ] Create Worker API routes `/api/chat`, `/api/config`, `/api/history`
- [ ] Implement KV read/write logic for config and chat history
- [ ] Integrate Cloudflare AI models API calls via Workers AI
- [ ] Proxy chat input to configurable MCP endpoints with fetch
- [ ] Create frontend UI served from Worker Sites:
    - Chat interface
    - Model / MCP selection
    - Config management
- [ ] Store secrets with Cloudflare environment variables
- [ ] Write README with setup and deploy instructions
- [ ] Test locally and deploy to Cloudflare with wrangler

***

This specification should enable a fully functional version 1 AI chat app hosted entirely on Cloudflare free-tier services with clear upgrade paths. The choice of KV as initial storage balances cost and simplicity, while TypeScript + wrangler aligns with best practices for Cloudflare Workers development.

Let me know if you want me to generate starter code or config files next!

<div style="text-align: center">⁂</div>

[^1]: https://dev.to/msarabi/deploying-your-telegram-bots-on-cloudflare-workers-a-step-by-step-guide-3cdk

[^2]: https://grammy.dev/hosting/cloudflare-workers-nodejs

[^3]: https://danielrodriguezcriado.es/blog/tutorials/chatbot-part1/

[^4]: https://developers.cloudflare.com/workers/tutorials/

[^5]: https://developers.cloudflare.com/workers/tutorials/deploy-a-realtime-chat-app/

[^6]: https://matthewzhaocc.com/build-a-backend-api-in-typescript-with-cloudflare-workers-d1-and-auth0-28a71f9775fd

[^7]: https://developers.cloudflare.com/workers/languages/typescript/

[^8]: https://github.com/letrieu/cloudflare-chatbot

[^9]: https://www.youtube.com/watch?v=Yyn3MLh8nYA

[^10]: https://developers.cloudflare.com/vectorize/get-started/embeddings/

