# SimpleAIChat - Cloudflare Workers AI Chat Interface

**ALWAYS** follow these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Project Overview

SimpleAIChat is a **Cloudflare Workers-based AI web chat interface** using TypeScript. The project creates an AI chat application hosted entirely on Cloudflare's free-tier services with API endpoints for chat, configuration, and history management using Cloudflare KV storage.

**Current Status**: Project is in specification phase - contains only specification.md with no implementation yet.

## Quick Start Commands

**ALWAYS** run these commands when starting work on this project:

```bash
# 1. Verify environment
node --version  # Should be v20+
npm --version   # Should be 10+
wrangler --version  # Should be 4.30.0+

# 2. If no project exists yet, create it:
npm create cloudflare@latest simple-ai-chat
# Follow prompts: Hello World → API starter → No git → No deploy
cd simple-ai-chat

# 3. Verify project works:
npx tsc --noEmit           # TypeScript check
npm run cf-typegen         # Generate types  
wrangler deploy --dry-run  # Validate config
wrangler dev &            # Start dev server
sleep 3                   # Wait for startup
curl http://localhost:8787/  # Test server responds
pkill -f "wrangler dev"   # Stop dev server

# 4. Read specification for implementation requirements:
cat ../specification.md   # If in generated project directory
```

## Working Effectively

### Bootstrap and Setup Commands
Run these commands to set up the development environment:

```bash
# Install Wrangler CLI globally (takes ~6 seconds)
npm install -g wrangler

# Verify wrangler installation
wrangler --version  # Should show wrangler 4.30.0+

# Create new Cloudflare Workers project with TypeScript
npm create cloudflare@latest my-ai-chat
# When prompted:
# 1. "What would you like to start with?" → Select "Hello World example"
# 2. "Which template would you like to use?" → Select "API starter (OpenAPI compliant)"  
# 3. "Do you want to use git for version control?" → Choose based on your needs
# 4. "Do you want to deploy your application?" → Select "No" for local development

# Navigate to project
cd my-ai-chat

# Verify setup works
npx tsc --noEmit     # TypeScript check (takes ~2 seconds)
npm run cf-typegen   # Generate Cloudflare types (takes ~1 second)
wrangler deploy --dry-run  # Validate deployment configuration (takes ~3 seconds)
```

### Development Workflow

#### Local Development
```bash
# Start local development server
npm run dev
# OR
wrangler dev
# NEVER CANCEL: Server takes 2-3 seconds to start. Set timeout to 30+ seconds.
# Server runs on http://localhost:8787 with live reload
```

#### Build and Type Checking
```bash
# TypeScript compilation check (takes ~2 seconds)
npx tsc --noEmit

# Generate Cloudflare Worker types (takes ~5 seconds)
npm run cf-typegen
```

#### Deployment
```bash
# Deploy to Cloudflare (requires authentication)
npm run deploy
# NEVER CANCEL: Deployment takes 10-30 seconds. Set timeout to 60+ seconds.
```

### Project Structure Understanding

**Current Repository Structure:**
```
/
├── .github/
│   └── copilot-instructions.md  # This file
└── specification.md             # Project requirements and architecture
```

**Generated Cloudflare Workers Project Structure:**
```
my-ai-chat/
├── src/
│   ├── endpoints/          # API endpoint handlers (taskCreate.ts, taskList.ts, etc.)
│   ├── index.ts           # Main Worker entry point
│   └── types.ts           # TypeScript type definitions
├── node_modules/          # Dependencies
├── .vscode/              # VS Code configuration
├── package.json          # npm configuration and scripts
├── package-lock.json     # Dependency lock file
├── tsconfig.json         # TypeScript configuration
├── wrangler.jsonc        # Cloudflare Workers configuration
├── worker-configuration.d.ts  # Generated Cloudflare types
├── .gitignore           # Git ignore rules
└── README.md            # Project documentation
```

**Key files in a Cloudflare Workers project:**
- `wrangler.jsonc` - Cloudflare Workers configuration (bindings, environment variables, KV namespaces)
- `src/index.ts` - Main Worker entry point (implements API routes)
- `src/endpoints/` - Individual API endpoint implementations
- `package.json` - npm dependencies and scripts (dev, deploy, cf-typegen)
- `worker-configuration.d.ts` - Generated TypeScript types for Cloudflare APIs

**Required dependencies for SimpleAIChat implementation:**
- `hono` - Web framework for Cloudflare Workers (already included in API starter)
- `chanfana` - OpenAPI framework for Workers (already included in API starter)
- `zod` - Schema validation (already included in API starter)
- `@cloudflare/ai` - For Cloudflare AI model integration (add when implementing)
- `@cloudflare/workers-types` - TypeScript types (add when implementing)

## Critical Configuration Requirements

### KV Namespace Setup
Add to `wrangler.jsonc` for data storage:
```jsonc
{
  "kv_namespaces": [
    { "binding": "CONFIG_KV", "id": "config-namespace-id" },
    { "binding": "HISTORY_KV", "id": "history-namespace-id" }
  ]
}
```

### Environment Variables
Set secrets for AI APIs:
```bash
# Set Cloudflare AI API token
wrangler secret put CLOUDFLARE_AI_TOKEN

# Set MCP endpoint URLs (if using external services)
wrangler secret put MCP_ENDPOINT_URL
```

## API Implementation Requirements

Based on specification.md, implement these endpoints in `src/index.ts`:

1. **POST /api/chat** - Handle chat messages, route to AI models/MCP servers
2. **GET/PUT /api/config** - Manage user configuration in KV storage  
3. **GET /api/history** - Retrieve chat history from KV storage

## Validation Scenarios

**ALWAYS** run these validation steps after making changes:

### 1. Basic Functionality Test
```bash
# Start dev server
wrangler dev

# Test health endpoint
curl http://localhost:8787/

# Test API endpoints (when implemented)
curl -X POST http://localhost:8787/api/chat -H "Content-Type: application/json" -d '{"message":"Hello"}'
```

### 2. Build Validation
```bash
# TypeScript compilation
npx tsc --noEmit

# Generate types
npm run cf-typegen
```

### 3. End-to-End Workflow Test
When implementing the chat interface:
1. Start the development server: `wrangler dev`
2. Open browser to http://localhost:8787 - should show Swagger/OpenAPI interface
3. Test API endpoints through Swagger UI or curl:
   ```bash
   # Test health/docs endpoint
   curl -i http://localhost:8787/
   
   # Test chat endpoint (when implemented)
   curl -X POST http://localhost:8787/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"Hello AI","model":"cloudflare"}'
   
   # Test config endpoints (when implemented)
   curl http://localhost:8787/api/config
   curl -X PUT http://localhost:8787/api/config \
     -H "Content-Type: application/json" \
     -d '{"selectedModel":"@cf/meta/llama-2-7b-chat-int8"}'
   
   # Test history endpoint (when implemented)
   curl http://localhost:8787/api/history
   ```
4. Verify chat message processing works end-to-end
5. Check configuration persistence through browser refresh
6. Test multiple chat messages build proper history

## Timing and Timeout Expectations

**NEVER CANCEL these operations - wait for completion:**

- **npm install (new project)**: 10-30 seconds - **NEVER CANCEL**, set timeout to 60+ seconds
- **wrangler dev startup**: 2-3 seconds - **NEVER CANCEL**, set timeout to 30+ seconds
- **TypeScript compilation**: 2-3 seconds - set timeout to 30+ seconds  
- **wrangler deploy**: 10-30 seconds - **NEVER CANCEL**, set timeout to 60+ seconds
- **npm run cf-typegen**: 1-2 seconds - set timeout to 30+ seconds
- **wrangler deploy --dry-run**: 2-5 seconds - set timeout to 30+ seconds

## Common Issues and Solutions

### Authentication Required
- `wrangler deploy` requires Cloudflare account authentication
- Use `wrangler login` to authenticate
- Some features require paid Cloudflare account for full testing

### KV Namespace Errors
- Create KV namespaces via Cloudflare dashboard or `wrangler kv:namespace create`
- Update `wrangler.jsonc` with correct namespace IDs

### TypeScript Errors  
- Ensure `worker-configuration.d.ts` exists and is up to date
- Run `npm run cf-typegen` to regenerate types
- Check `tsconfig.json` includes proper Cloudflare Workers types

## Development Best Practices

### Always Do This Before Committing
```bash
# Run TypeScript check
npx tsc --noEmit

# Test dev server starts successfully  
wrangler dev
# Stop after verifying startup (Ctrl+C)
```

### Project-Specific Commands
Based on specification.md requirements:

```bash
# Install AI/MCP related dependencies (when implementing)
npm install @cloudflare/ai @cloudflare/workers-types

# Add KV namespace bindings for configuration and history
wrangler kv:namespace create "CONFIG"
wrangler kv:namespace create "HISTORY"
```

## Repository Navigation

### Key Files to Modify
- `specification.md` - Project requirements and architecture
- `src/index.ts` - Main Worker implementation (when created)
- `src/endpoints/` - API endpoint handlers (when created)
- `wrangler.jsonc` - Worker configuration
- `package.json` - Dependencies and scripts

### Important Locations
- **Specification**: Read `specification.md` for complete project requirements
- **API Design**: See specification sections 3, 7 for endpoint details
- **Technology Stack**: See specification section 1 for technology decisions
- **Security Requirements**: See specification section 5 for security guidelines

## Testing and Debugging

### Local Testing
```bash
# Test with curl commands
curl -i http://localhost:8787/
curl -X POST http://localhost:8787/api/chat -H "Content-Type: application/json" -d '{"message":"test"}'
```

### Debug Mode
```bash
# Enable debug logging
wrangler dev --local --debug
```

### Browser Testing  
- Open http://localhost:8787 for OpenAPI documentation interface
- Use browser dev tools to test API endpoints
- Verify chat interface functionality (when implemented)

## External Dependencies

**Required for full functionality:**
- Cloudflare account (free tier sufficient for basic testing)
- Cloudflare AI Workers access (free tier available)
- Optional: External MCP server endpoints

**Limitations in sandbox environment:**
- Cannot authenticate with Cloudflare (wrangler login fails)
- Cannot create KV namespaces remotely
- Cannot deploy to production
- Can develop and test locally without issues