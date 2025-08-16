# SimpleAIChat - Cloudflare Workers AI Chat Interface

**ALWAYS follow these instructions first.** Only search for additional information or run discovery commands if these instructions are incomplete or found to be in error.

## Project Overview

SimpleAIChat is a **Cloudflare Workers-based AI web chat interface** built with **TypeScript**. The application provides a web UI for chatting with AI models via Cloudflare Workers AI APIs and external MCP (Model Context Protocol) servers. The project uses Cloudflare's free-tier services including Workers, KV storage, and Workers Sites for frontend hosting.

## Essential Setup and Build Instructions

### Bootstrap the Development Environment

**CRITICAL: NEVER CANCEL builds or long-running commands. Wait for completion.**

1. **Install Wrangler CLI globally:**
   ```bash
   npm install -g wrangler
   ```
   - **Timing:** ~5 seconds. NEVER CANCEL.
   - **Verification:** Run `wrangler --version` to confirm installation.

2. **Create new Cloudflare Workers project (if starting from scratch):**
   ```bash
   npm create cloudflare@latest my-ai-chat
   ```
   - **Interactive choices:** Select "Hello World example" → "SSR / full-stack app" → "TypeScript" → "Yes" for git → "No" for deploy
   - **Timing:** ~2 minutes. NEVER CANCEL. Set timeout to 5+ minutes.
   - **Note:** This command is for bootstrapping new projects, not needed for existing repository work.

3. **Install dependencies in existing project:**
   ```bash
   npm install
   ```
   - **Timing:** ~30 seconds. NEVER CANCEL.

### Development Workflow

4. **Start development server:**
   ```bash
   npm run dev
   # Alternative: npm run start
   ```
   - **Timing:** Starts in ~3 seconds, runs continuously. NEVER CANCEL.
   - **Access:** Opens server at http://localhost:8787
   - **Interactive features:** Press [b] for browser, [d] for devtools, [c] to clear console, [x] to exit

5. **Run tests:**
   ```bash
   npm run test
   ```
   - **Timing:** ~2 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
   - **Uses:** Vitest with Cloudflare Workers test environment

6. **Type checking:**
   ```bash
   npx tsc --noEmit
   ```
   - **Timing:** ~2 seconds. NEVER CANCEL.

7. **Format code:**
   ```bash
   npx prettier --write .
   ```
   - **Timing:** ~2 seconds for formatting check/fix. NEVER CANCEL.
   - **Check only:** `npx prettier --check .`

8. **Generate Cloudflare types:**
   ```bash
   npm run cf-typegen
   ```
   - **Timing:** ~10 seconds. NEVER CANCEL.
   - **Purpose:** Updates `worker-configuration.d.ts` with latest Cloudflare types

## Project Structure and Key Files

### Root Directory Contents
```
├── .editorconfig          # Editor configuration
├── .gitignore            # Git ignore rules
├── .prettierrc           # Prettier configuration
├── package.json          # NPM dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vitest.config.mts     # Test configuration
├── wrangler.jsonc        # Cloudflare Workers configuration
├── worker-configuration.d.ts  # Generated Cloudflare types
├── public/               # Static assets (served by Workers Sites)
│   └── index.html        # Main HTML file
├── src/                  # TypeScript source code
│   └── index.ts          # Main Worker entry point
└── test/                 # Test files
    ├── env.d.ts          # Test environment types
    ├── index.spec.ts     # Main test file
    └── tsconfig.json     # Test TypeScript config
```

### Key Configuration Files

**wrangler.jsonc** - Cloudflare Workers configuration:
- Main entry point: `src/index.ts`
- Assets directory: `public/` (for static files)
- Contains bindings for KV, secrets, and other Cloudflare services

**package.json scripts:**
- `npm run dev` / `npm run start` - Development server
- `npm run deploy` - Deploy to Cloudflare
- `npm run test` - Run test suite
- `npm run cf-typegen` - Generate Cloudflare types

## Cloudflare Workers Development

### Adding KV Storage Binding

1. **Create KV namespace:**
   ```bash
   wrangler kv namespace create "CONFIG"
   wrangler kv namespace create "CHAT_HISTORY"
   ```

2. **Add to wrangler.jsonc:**
   ```jsonc
   {
     "kv_namespaces": [
       { "binding": "CONFIG", "id": "your-namespace-id" },
       { "binding": "CHAT_HISTORY", "id": "your-namespace-id" }
     ]
   }
   ```

3. **Regenerate types:**
   ```bash
   npm run cf-typegen
   ```

### Adding Secrets

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put CLOUDFLARE_AI_TOKEN
```

### Workers AI Integration

The project uses Cloudflare Workers AI. Access it via the `env.AI` binding in your Worker code:

```typescript
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const response = await env.AI.run("@cf/meta/llama-2-7b-chat-int8", {
      messages: [{ role: "user", content: "Hello" }]
    });
    return Response.json(response);
  }
} satisfies ExportedHandler<Env>;
```

## Validation and Testing

### Manual Validation Scenarios

**ALWAYS test these scenarios after making changes:**

1. **Basic functionality test:**
   - Start dev server: `npm run dev`
   - Visit http://localhost:8787
   - Verify page loads with "Hello, World!" content
   - Test API endpoint: `curl http://localhost:8787/message`
   - Test random UUID: `curl http://localhost:8787/random`

2. **Build and type checking:**
   - Run: `npx tsc --noEmit`
   - Run: `npm run test`
   - Run: `npx prettier --check .`

3. **Advanced features (if implemented):**
   - Test chat interface functionality
   - Verify KV storage read/write operations
   - Test AI model integration
   - Validate MCP server proxy functionality

### Pre-commit Validation

**ALWAYS run these commands before committing:**

```bash
npm run test        # Tests pass
npx tsc --noEmit    # No TypeScript errors
npx prettier --write .  # Format code
```

## Common Development Tasks

### Implementing API Endpoints

Add new routes in `src/index.ts`:

```typescript
switch (url.pathname) {
  case '/api/chat':
    return handleChat(request, env);
  case '/api/config':
    return handleConfig(request, env);
  case '/api/history':
    return handleHistory(request, env);
}
```

### Frontend Development

- Static files go in `public/` directory
- HTML, CSS, and client-side JavaScript are served via Workers Sites
- Reference the specification.md for detailed API requirements

### Database/Storage Operations

- Use KV bindings for simple key-value storage
- Consider Durable Objects for complex state management
- Use D1 for relational data (paid tier)

## Deployment

**Local deployment test:**
```bash
wrangler deploy --dry-run
```

**Actual deployment:**
```bash
npm run deploy
# Alternative: wrangler deploy
```

## Troubleshooting

### Common Issues

1. **"Module not found" errors:** Run `npm install`
2. **Type errors:** Run `npm run cf-typegen`
3. **Port 8787 in use:** Stop existing dev server or use different port
4. **Authentication errors:** Run `wrangler login`

### Development Server Not Starting
- Check if port 8787 is available
- Verify wrangler.jsonc syntax is valid JSON
- Ensure all dependencies are installed

### Build Failures
- Check TypeScript compilation: `npx tsc --noEmit`
- Verify all imports are correct
- Check wrangler.jsonc for syntax errors

## Reference Commands Output

### Package.json (typical structure)
```json
{
  "name": "my-ai-chat",
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev",
    "start": "wrangler dev",
    "test": "vitest",
    "cf-typegen": "wrangler types"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.19",
    "typescript": "^5.5.2",
    "vitest": "~3.2.0",
    "wrangler": "^4.30.0"
  }
}
```

### Available wrangler commands
- `wrangler dev` - Local development server
- `wrangler deploy` - Deploy to Cloudflare
- `wrangler kv namespace create <name>` - Create KV namespace
- `wrangler secret put <name>` - Add secret
- `wrangler tail` - View live logs
- `wrangler types` - Generate TypeScript types

## Critical Reminders

- **NEVER CANCEL** any build or test command. Wait for completion.
- **ALWAYS** test locally with `npm run dev` before deploying
- **ALWAYS** run the full validation suite before committing changes
- **ALWAYS** regenerate types after changing wrangler.jsonc: `npm run cf-typegen`
- Use appropriate timeouts: 5+ minutes for project creation, 30+ seconds for tests
- The development server runs on http://localhost:8787 by default
- Static files are served from the `public/` directory
- Worker code entry point is `src/index.ts`

---

**This specification aligns with the detailed requirements in specification.md. Always reference both this file and the specification when implementing features.**