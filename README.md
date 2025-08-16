# Simple AI Chat

A Cloudflare Workers-based AI chat interface built with TypeScript, featuring integration with Cloudflare AI models and persistent storage.

## Features

- 🤖 **Multiple AI Models**: Support for Llama 3.1 8B/70B, Microsoft Phi-2, and Mistral 7B
- 💾 **Persistent Storage**: Chat history and user configuration stored in Cloudflare KV
- 📊 **Usage Monitoring**: Real-time quota tracking and usage statistics
- 🔒 **Session Management**: Secure session-based authentication
- 🚀 **Rate Limiting**: Built-in protection against abuse
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ⚡ **Serverless**: Fully hosted on Cloudflare's edge network

## Architecture

- **Frontend**: Vanilla JavaScript/TypeScript SPA served from Workers Static Assets
- **Backend**: Cloudflare Workers with TypeScript
- **Storage**: Cloudflare KV for configuration, sessions, and chat history
- **AI**: Cloudflare Workers AI for model inference
- **Authentication**: Session-based with automatic session creation

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send chat message and receive AI response |
| `/api/config` | GET/PUT | Manage user configuration |
| `/api/history` | GET | Retrieve chat history with pagination |
| `/api/usage` | GET | Get current usage statistics and quotas |
| `/api/health` | GET | Check system health and service status |

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers enabled
- Wrangler CLI installed globally: `npm install -g wrangler`

### Setup Instructions

1. **Clone and Install Dependencies**
   ```bash
   git clone [<repository-url>](https://github.com/raymondclowe/SimpleAIChat)
   cd SimpleAIChat
   npm install
   ```

2. **Configure Cloudflare**
   ```bash
   # For local/dev environments without a browser, use an API token:
   # 1. Go to https://dash.cloudflare.com/profile/api-tokens
   # 2. Create a token with "Edit Cloudflare Workers" permissions
   # 3. In your project root, create a file named .env and add:
   #    CLOUDFLARE_API_TOKEN=your_token_here
   # Wrangler will use this token for authentication.
   
   # Create KV namespaces
   wrangler kv:namespace create "CONFIG_KV"
   wrangler kv:namespace create "SESSIONS_KV" 
   wrangler kv:namespace create "CHAT_HISTORY_KV"
   
   # Create preview namespaces for development
   wrangler kv:namespace create "CONFIG_KV" --preview
   wrangler kv:namespace create "SESSIONS_KV" --preview
   wrangler kv:namespace create "CHAT_HISTORY_KV" --preview
   ```

3. **Update wrangler.toml**
   
   Replace the placeholder IDs in `wrangler.toml` with the actual values:
   
   a. **Get your Cloudflare Account ID**:
      ```bash
      wrangler whoami
      # Note the Account ID shown
      ```
   
   b. **Update the configuration file**:
   ```toml
   [vars]
   ENVIRONMENT = "development"
   CLOUDFLARE_ACCOUNT_ID = "your-actual-account-id"
   
   [[kv_namespaces]]
   binding = "CONFIG_KV"
   preview_id = "your-preview-id-here"
   id = "your-production-id-here"
   
   [[kv_namespaces]]
   binding = "SESSIONS_KV"
   preview_id = "your-preview-id-here"
   id = "your-production-id-here"
   
   [[kv_namespaces]]
   binding = "CHAT_HISTORY_KV"
   preview_id = "your-preview-id-here"
   id = "your-production-id-here"
   ```

4. **Set up Cloudflare AI API Key**
   ```bash
   wrangler secret put COPILOT_CLOUDFLARE_GLOBAL
   # Enter your Cloudflare API key when prompted
   ```

5. **Development**
   ```bash
   # Start local development server
   npm run dev
   
   # The app will be available at http://localhost:8787
   ```

6. **Deployment**
   ```bash
   # Deploy to Cloudflare Workers
   npm run deploy
   ```

## Configuration

### Environment Variables

* `COPILOT_CLOUDFLARE_GLOBAL`: Cloudflare API key for Workers AI access
* `CLOUDFLARE_API_TOKEN`: API token for headless authentication (recommended for remote/dev environments)
* `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
* `ENVIRONMENT`: Set to "production" for production deployment

### KV Namespaces

- `CONFIG_KV`: Stores user configuration and preferences
- `SESSIONS_KV`: Manages user sessions and rate limiting
- `CHAT_HISTORY_KV`: Stores chat message history

### Rate Limits (Free Tier)

- **Requests**: 100 per hour, 1000 per day per session
- **Neurons**: 10,000 per day (Cloudflare AI free tier)
- **KV Operations**: 100K reads, 1K writes per day

## Usage

1. **Start a Chat**: Open the app and start typing - a session will be created automatically
2. **Select Model**: Choose from available AI models in the dropdown
3. **Monitor Usage**: View real-time neuron and request usage in the header
4. **Configuration**: Click the settings button to adjust preferences
5. **Chat History**: Previous conversations are automatically saved and restored

## Available Models

| Model | Description | Best For | Token Limit |
|-------|-------------|----------|-------------|
| Llama 3.1 8B | Fast and efficient | General conversation | 2048 |
| Llama 3.1 70B | Superior reasoning | Complex tasks | 4096 |
| Microsoft Phi-2 | Optimized for coding | Programming tasks | 1024 |
| Mistral 7B | Instruction following | Structured tasks | 2048 |

## Cost Estimates

| Usage Level | Monthly Cost | Required Upgrades |
|-------------|--------------|------------------|
| 1-10 users | $0 | None (free tier) |
| 10-50 users | $15-30 | Workers Paid + AI overages |
| 50-200 users | $50-150 | + Durable Objects |
| 200+ users | $150+ | + D1 database |

## Development

### Project Structure

```
src/
├── index.ts          # Main Worker script and routing
├── types.ts          # TypeScript type definitions
├── utils.ts          # Utility functions and session management
├── ai-handler.ts     # AI model integration and chat logic
└── api-handlers.ts   # API endpoint handlers

public/               # Static assets (embedded in Worker)
wrangler.toml        # Cloudflare Workers configuration
package.json         # Node.js dependencies and scripts
tsconfig.json        # TypeScript configuration
```

### Scripts

- `npm run dev`: Start local development server
- `npm run deploy`: Deploy to Cloudflare Workers
- `npm run build`: Compile TypeScript
- `npm run type-check`: Type checking without compilation
- `npm run lint`: Run ESLint

### Adding New Features

1. **New API Endpoint**: Add route in `src/index.ts` and handler in `src/api-handlers.ts`
2. **New AI Model**: Add to `AVAILABLE_MODELS` in `src/ai-handler.ts`
3. **Frontend Changes**: Modify embedded HTML/CSS/JS in `src/index.ts`

## Security

- All user input is sanitized and validated
- Session-based authentication with automatic expiration
- Rate limiting prevents abuse
- Secrets stored securely in Cloudflare environment variables
- HTTPS enforced by default on Cloudflare Workers

## Troubleshooting

### Common Issues

1. **"Session creation failed"**: Check KV namespace configuration in wrangler.toml
2. **"AI request failed"**: Verify COPILOT_CLOUDFLARE_GLOBAL secret is set correctly
3. **"Rate limit exceeded"**: Wait for quota reset or upgrade to paid tier
4. **"Quota exceeded"**: Daily neuron limit reached, resets at midnight UTC

### Debug Mode

Enable detailed logging by setting `ENVIRONMENT=development` in wrangler.toml

### Health Check

Visit `/api/health` to check system status and service availability.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with `npm run dev`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review Cloudflare Workers documentation
- Create an issue in the repository

---

Built with ❤️ using Cloudflare Workers, TypeScript, and the power of edge computing.
