import { Env } from './types';
import { 
  createJsonResponse, 
  handleCorsOptions, 
  createSession, 
  getSession, 
  updateSessionActivity, 
  checkRateLimit 
} from './utils';
import { handleChatRequest, handleUsageRequest } from './ai-handler';
import { 
  handleConfigGet, 
  handleConfigPut, 
  handleHistoryGet, 
  handleHealthCheck 
} from './api-handlers';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    console.log(`[main] ${request.method} ${url.pathname}`);
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      console.log('[main] CORS preflight');
      return handleCorsOptions();
    }

    // Health check endpoint (no authentication required)
    if (url.pathname === '/api/health') {
      console.log('[main] Health check endpoint');
      return handleHealthCheck(request, env);
    }

    // Serve static assets
    if (!url.pathname.startsWith('/api/')) {
      console.log('[main] Serving static asset');
      return await handleStaticAssets(request, env);
    }
    
  // Get available Workers AI models from Cloudflare API
  async function handleModelsGet(request: Request, env: Env): Promise<Response> {
    try {
      console.log('[models] Fetching live model list from Cloudflare API...');
      
      // Use the correct Cloudflare API endpoint for Workers AI models
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/models/search?per_page=50`;
      
      console.log('[models] API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.CLOUDFLARE_AI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[models] API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[models] Cloudflare API error:', response.status, errorText);
        
        // Fallback to a curated list of known working models
        console.log('[models] Falling back to curated model list');
        const fallbackModels = [
          {
            id: '@cf/meta/llama-3.1-8b-instruct',
            name: 'Llama 3.1 8B Instruct',
            description: 'Fast and efficient model for general conversations',
            max_tokens: 2048,
          },
          {
            id: '@cf/meta/llama-3.1-70b-instruct',
            name: 'Llama 3.1 70B Instruct',
            description: 'Large model with superior reasoning capabilities',
            max_tokens: 4096,
          },
          {
            id: '@cf/microsoft/phi-2',
            name: 'Microsoft Phi-2',
            description: 'Compact model optimized for coding tasks',
            max_tokens: 1024,
          },
          {
            id: '@cf/mistral/mistral-7b-instruct-v0.1',
            name: 'Mistral 7B Instruct',
            description: 'Balanced model for instruction following',
            max_tokens: 2048,
          },
          {
            id: '@cf/qwen/qwen1.5-14b-chat-awq',
            name: 'Qwen 1.5 14B Chat',
            description: 'Advanced model with strong reasoning capabilities',
            max_tokens: 2048,
          },
          {
            id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
            name: 'DeepSeek R1 Distill Qwen 32B',
            description: 'Advanced reasoning model with problem-solving capabilities',
            max_tokens: 4096,
          },
          {
            id: '@cf/qwen/qwen2.5-coder-32b-instruct',
            name: 'Qwen 2.5 Coder 32B Instruct',
            description: 'State-of-the-art open-source code generation model',
            max_tokens: 4096,
          },
          {
            id: '@cf/google/gemma-3-12b-it',
            name: 'Google Gemma 3 12B IT',
            description: 'Latest Gemma model with 128K context and multilingual support',
            max_tokens: 8192,
          },
        ];
        
        return new Response(
          JSON.stringify({ success: true, models: fallbackModels }),
          { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      const data = await response.json() as { result?: any[], success?: boolean };
      console.log('[models] API response success:', data.success);
      console.log('[models] API response result length:', data.result?.length || 0);
      console.log('[models] First few models:', JSON.stringify(data.result?.slice(0, 3) || []));
      
      if (!data.success) {
        throw new Error('API returned success: false');
      }
      
      if (!data.result || data.result.length === 0) {
        console.log('[models] No models returned from API, using fallback');
        throw new Error('No models returned from API');
      }
      
      // Transform the API response to our frontend format
      const models = data.result.map((model: any) => ({
        id: model.name || model.id,
        name: model.display_name || model.name || model.id,
        description: model.description || `AI model ${model.name || model.id}`,
        max_tokens: model.properties?.max_tokens || 2048,
      }));
      
      console.log('[models] Returning', models.length, 'models from API');
      return new Response(
        JSON.stringify({ success: true, models }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
    } catch (err: any) {
      console.error('[models] Error fetching model list:', err);
      
      // Fallback to curated list on any error
      console.log('[models] Error occurred, falling back to curated model list');
      const fallbackModels = [
        {
          id: '@cf/meta/llama-3.1-8b-instruct',
          name: 'Llama 3.1 8B Instruct',
          description: 'Fast and efficient model for general conversations',
          max_tokens: 2048,
        },
        {
          id: '@cf/meta/llama-3.1-70b-instruct',
          name: 'Llama 3.1 70B Instruct',
          description: 'Large model with superior reasoning capabilities',
          max_tokens: 4096,
        },
        {
          id: '@cf/microsoft/phi-2',
          name: 'Microsoft Phi-2',
          description: 'Compact model optimized for coding tasks',
          max_tokens: 1024,
        },
        {
          id: '@cf/mistral/mistral-7b-instruct-v0.1',
          name: 'Mistral 7B Instruct',
          description: 'Balanced model for instruction following',
          max_tokens: 2048,
        },
        {
          id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
          name: 'DeepSeek R1 Distill Qwen 32B',
          description: 'Advanced reasoning model with problem-solving capabilities',
          max_tokens: 4096,
        },
        {
          id: '@cf/qwen/qwen2.5-coder-32b-instruct',
          name: 'Qwen 2.5 Coder 32B Instruct',
          description: 'State-of-the-art open-source code generation model',
          max_tokens: 4096,
        },
      ];
      
      return new Response(
        JSON.stringify({ success: true, models: fallbackModels }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

    // All API endpoints require session management
    console.log('[main] API endpoint, checking session...');
    const session = await handleSessionAuth(request, env);
    console.log('[main] Session result:', session.success ? 'SUCCESS' : 'FAILED');
    if (!session.success) {
      console.log('[main] Session failed, returning error response');
      return session.response!;
    }

    // Rate limiting check
    const rateLimitCheck = await checkRateLimit(env, session.session);
    if (!rateLimitCheck.allowed) {
      return createJsonResponse({
        success: false,
        error: {
          error: 'rate_limited',
          message: 'Rate limit exceeded',
          retry_after: rateLimitCheck.retryAfter,
        },
      }, 429);
    }

  try {
        console.log(`[main] Routing to ${url.pathname}`);
        switch (url.pathname) {
            case '/api/models':
                if (request.method === 'GET') {
                    console.log('[main] Calling handleModelsGet');
                    return await handleModelsGet(request, env);
                }
                break;
            case '/api/chat':
                if (request.method === 'POST') {
                    console.log('[main] Calling handleChatRequest');
                    return await handleChatRequest(request, env, session.session);
                }
                break;
            case '/api/config':
                if (request.method === 'GET') {
                    console.log('[main] Calling handleConfigGet');
                    return await handleConfigGet(request, env, session.session);
                } else if (request.method === 'PUT') {
                    console.log('[main] Calling handleConfigPut');
                    return await handleConfigPut(request, env, session.session);
                }
                break;
            case '/api/history':
                if (request.method === 'GET') {
                    console.log('[main] Calling handleHistoryGet');
                    return await handleHistoryGet(request, env, session.session);
                }
                break;
            case '/api/usage':
                if (request.method === 'GET') {
                    console.log('[main] Calling handleUsageRequest');
                    return await handleUsageRequest(request, env, session.session);
                } else {
                    return createJsonResponse({
                        success: false,
                        error: {
                            error: 'method_not_allowed',
                            message: 'Method not allowed for /api/usage',
                        },
                    }, 405);
                }
                break;
            default:
                console.log('[main] Unknown endpoint:', url.pathname);
                return createJsonResponse({
                    success: false,
                    error: {
                        error: 'not_found',
                        message: 'Endpoint not found',
                    },
                }, 404);
        }
        // Method not allowed fallback
        console.log(`[main] Method ${request.method} not allowed for ${url.pathname}`);
        return createJsonResponse({
            success: false,
            error: {
                error: 'method_not_allowed',
                message: 'Method not allowed for this endpoint',
            },
        }, 405);
    } catch (error) {
            console.error('Error processing request:', error);
            return createJsonResponse({
                success: false,
                error: {
                    error: 'internal_error',
                    message: 'An internal server error occurred',
                },
            }, 500);
        }
            }
        }

// --- Worker helper functions ---
async function handleSessionAuth(request: Request, env: Env): Promise<{ success: boolean; session?: any; response?: Response }> {
    console.log('[session] Starting session auth');
    const sessionHeader = request.headers.get('X-Session-ID');
    console.log('[session] Session header:', sessionHeader);
  
    if (sessionHeader) {
        // Try to get existing session
        console.log('[session] Looking up existing session');
        const session = await getSession(env, sessionHeader);
        if (session) {
            console.log('[session] Found existing session:', session.session_id);
            await updateSessionActivity(env, session);
            return { success: true, session };
        }
        console.log('[session] Session not found, creating new one');
    }

    // Create new session
    try {
        console.log('[session] Creating new session');
        const userAgent = request.headers.get('User-Agent') || 'unknown';
        const newSession = await createSession(env, userAgent);
        console.log('[session] Created new session:', newSession.session_id);
        // For API requests, proceed with the new session instead of returning session creation response
        return { 
            success: true, 
            session: newSession 
        };
    } catch (error) {
        console.error('[session] Error creating session:', error);
        return {
            success: false,
            response: createJsonResponse({
                success: false,
                error: {
                    error: 'session_error',
                    message: 'Failed to create session',
                },
            }, 500),
        };
    }
}

async function handleStaticAssets(request: Request, env: Env): Promise<Response> {
    // Minimal static asset handler for index.html, style.css, app.js
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (pathname === '/' || pathname === '/index.html') {
        return new Response(getIndexHTML(), {
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    }
    if (pathname === '/style.css') {
        return new Response(getStyleCSS(), {
            headers: {
                'Content-Type': 'text/css',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    }
    if (pathname === '/app.js') {
        return new Response(getAppJS(), {
            headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    }
    // File not found
    return new Response('Not Found', { status: 404 });
}

// --- Frontend helpers below ---
function getIndexHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Simple AI Chat</title>
        <link rel="stylesheet" href="/style.css">
</head>
<body>
        <div id="app">
                <header>
                        <h1>🤖 Simple AI Chat</h1>
                        <div id="usage-display">
                                <span id="quota-info">Loading...</span>
                        </div>
                </header>
        
                <main>
                        <div id="chat-container">
                                <div id="chat-messages"></div>
                                <div id="loading" class="hidden">AI is thinking...</div>
                        </div>
            
                        <div id="input-container">
                                <div id="model-selector">
                                        <label for="model-select">Model:</label>
                                        <select id="model-select"></select>
                                </div>
                
                                <div id="message-input-container">
                                        <textarea id="message-input" placeholder="Type your message here..." rows="3"></textarea>
                                        <button id="send-button">Send</button>
                                </div>
                        </div>
                </main>
        
                <aside id="config-panel" class="hidden">
                        <h3>Configuration</h3>
                        <div id="config-content">
                                <!-- Config options will be loaded here -->
                        </div>
                </aside>
        </div>
    
        <button id="config-toggle">⚙️</button>
    
        <script src="/app.js"></script>
</body>
</html>`;
}

function getStyleCSS(): string {
  return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

#app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    display: grid;
    grid-template-rows: auto 1fr;
    grid-template-columns: 1fr auto;
    gap: 20px;
    min-height: 100vh;
}

header {
    grid-column: 1 / -1;
    background: rgba(255, 255, 255, 0.95);
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

h1 {
    color: #5a67d8;
    font-size: 2rem;
}

#usage-display {
    background: #f7fafc;
    padding: 10px 15px;
    border-radius: 8px;
    border-left: 4px solid #5a67d8;
}

main {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 15px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

#chat-container {
    flex: 1;
    margin-bottom: 20px;
    min-height: 400px;
}

#chat-messages {
    max-height: 500px;
    overflow-y: auto;
    padding: 10px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
}

.message {
    margin-bottom: 15px;
    padding: 12px;
    border-radius: 8px;
    max-width: 80%;
}

.message.user {
    background: #5a67d8;
    color: white;
    margin-left: auto;
    text-align: right;
}

.message.assistant {
    background: #e2e8f0;
    color: #2d3748;
}

.message-meta {
    font-size: 0.8em;
    opacity: 0.7;
    margin-top: 5px;
}

#loading {
    text-align: center;
    padding: 20px;
    color: #5a67d8;
    font-style: italic;
}

#input-container {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

#model-selector {
    display: flex;
    align-items: center;
    gap: 10px;
}

#model-select {
    padding: 8px 12px;
    border: 2px solid #e2e8f0;
    border-radius: 6px;
    background: white;
    min-width: 250px;
}

#message-input-container {
    display: flex;
    gap: 10px;
    align-items: flex-end;
}

#message-input {
    flex: 1;
    padding: 12px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    resize: vertical;
    font-family: inherit;
    font-size: 14px;
}

#message-input:focus {
    outline: none;
    border-color: #5a67d8;
}

#send-button {
    padding: 12px 24px;
    background: #5a67d8;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
}

#send-button:hover {
    background: #4c51bf;
}

#send-button:disabled {
    background: #a0aec0;
    cursor: not-allowed;
}

#config-panel {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 15px;
    padding: 20px;
    width: 300px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

#config-toggle {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #5a67d8;
    color: white;
    border: none;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    font-size: 1.2em;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s;
}

#config-toggle:hover {
    transform: scale(1.1);
}

.hidden {
    display: none;
}

.error {
    background: #fed7d7;
    color: #c53030;
    padding: 10px;
    border-radius: 6px;
    margin: 10px 0;
}

.success {
    background: #c6f6d5;
    color: #22543d;
    padding: 10px;
    border-radius: 6px;
    margin: 10px 0;
}

@media (max-width: 768px) {
    #app {
        grid-template-columns: 1fr;
        padding: 10px;
    }
    
    #config-panel {
        width: 100%;
        grid-column: 1;
    }
    
    header {
        flex-direction: column;
        gap: 10px;
        text-align: center;
    }
    
    #message-input-container {
        flex-direction: column;
    }
    
    .message {
        max-width: 95%;
    }
}`;
}

function getAppJS(): string {
  return `class SimpleAIChat {
    constructor() {
        try {
            console.log('[frontend] SimpleAIChat constructor starting...');
            this.sessionId = localStorage.getItem('sessionId');
            this.isLoading = false;
            console.log('[frontend] Calling initializeApp...');
            this.initializeApp();
            console.log('[frontend] Calling loadUsageStats...');
            this.loadUsageStats();
            console.log('[frontend] Calling loadChatHistory...');
            this.loadChatHistory();
            console.log('[frontend] Calling loadModels...');
            this.loadModels();
            console.log('[frontend] Constructor completed successfully');
        } catch (error) {
            console.error('[frontend] Constructor error:', error);
        }
    }
    async loadModels() {
        console.log('[frontend] Loading models...');
        const modelSelect = document.getElementById('model-select');
        modelSelect.innerHTML = '<option>Loading models...</option>';
        try {
            console.log('[frontend] Fetching /api/models');
            const response = await fetch('/api/models');
            console.log('[frontend] Models response:', response.status);
            const data = await response.json();
            console.log('[frontend] Models data:', data);
            if (data.success && Array.isArray(data.models)) {
                modelSelect.innerHTML = '';
                data.models.forEach(model => {
                    const opt = document.createElement('option');
                    opt.value = model.id;
                    opt.textContent = model.name || model.id;
                    modelSelect.appendChild(opt);
                });
                console.log('[frontend] Loaded', data.models.length, 'models');
            } else {
                modelSelect.innerHTML = '<option>No models available</option>';
                console.log('[frontend] No models available in response');
            }
        } catch (err) {
            modelSelect.innerHTML = '<option>Error loading models</option>';
            console.error('[frontend] Error loading models:', err);
        }
    }

    async initializeApp() {
        this.bindEvents();
        this.setupKeyboardShortcuts();
        
        // Create session if needed
        if (!this.sessionId) {
            await this.createSession();
        }
    }

    bindEvents() {
        const sendButton = document.getElementById('send-button');
        const messageInput = document.getElementById('message-input');
        const configToggle = document.getElementById('config-toggle');
        
        sendButton.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        configToggle.addEventListener('click', () => this.toggleConfig());
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendMessage();
                }
            }
        });
    }

    async createSession() {
        try {
            const response = await fetch('/api/usage', {
                method: 'GET',
            });
            
            if (response.ok) {
                const sessionId = response.headers.get('X-Session-ID');
                if (sessionId) {
                    this.sessionId = sessionId;
                    localStorage.setItem('sessionId', sessionId);
                }
            }
        } catch (error) {
            console.error('Error creating session:', error);
        }
    }

    async sendMessage() {
        if (this.isLoading) return;
        
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        const selectedModel = document.getElementById('model-select').value;
        
        this.isLoading = true;
        this.updateUI();
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        messageInput.value = '';
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId,
                },
                body: JSON.stringify({
                    message: message,
                    model: selectedModel,
                    max_tokens: 500,
                }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.addMessageToChat('assistant', data.data.response, {
                    model: data.data.model_used,
                    neurons: data.data.usage.neurons_used,
                });
                this.updateUsageDisplay(data.data.usage);
            } else {
                this.showError(data.error.message);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message. Please try again.');
        } finally {
            this.isLoading = false;
            this.updateUI();
        }
    }

    addMessageToChat(role, content, meta = {}) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = \`message \${role}\`;
        
        const contentDiv = document.createElement('div');
        contentDiv.textContent = content;
        messageDiv.appendChild(contentDiv);
        
        if (meta.model || meta.neurons) {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'message-meta';
            const metaText = [];
            if (meta.model) metaText.push(\`Model: \${meta.model.split('/').pop()}\`);
            if (meta.neurons) metaText.push(\`Neurons: \${meta.neurons}\`);
            metaDiv.textContent = metaText.join(' • ');
            messageDiv.appendChild(metaDiv);
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    updateUI() {
        const sendButton = document.getElementById('send-button');
        const messageInput = document.getElementById('message-input');
        const loading = document.getElementById('loading');
        
        sendButton.disabled = this.isLoading;
        messageInput.disabled = this.isLoading;
        
        if (this.isLoading) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    async loadUsageStats() {
        try {
            const response = await fetch('/api/usage', {
                headers: {
                    'X-Session-ID': this.sessionId,
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateUsageDisplay(data.data);
                }
            }
        } catch (error) {
            console.error('Error loading usage stats:', error);
        }
    }

    updateUsageDisplay(usage) {
        const quotaInfo = document.getElementById('quota-info');
        const remaining = usage.remaining_quota || (usage.quota_limit - usage.daily_neurons_used);
        const percentage = ((usage.quota_limit - remaining) / usage.quota_limit * 100).toFixed(1);
        
        quotaInfo.textContent = \`Neurons: \${usage.quota_limit - remaining}/\${usage.quota_limit} (\${percentage}%) • Requests: \${usage.daily_requests || 0}\`;
    }

    async loadChatHistory() {
        try {
            const response = await fetch('/api/history?limit=20', {
                headers: {
                    'X-Session-ID': this.sessionId,
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.messages) {
                    const chatMessages = document.getElementById('chat-messages');
                    chatMessages.innerHTML = '';
                    
                    data.data.messages.forEach(msg => {
                        this.addMessageToChat(msg.role, msg.content, {
                            model: msg.model_used,
                            neurons: msg.neurons_used,
                        });
                    });
                }
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    toggleConfig() {
        const configPanel = document.getElementById('config-panel');
        configPanel.classList.toggle('hidden');
    }

    showError(message) {
        const chatMessages = document.getElementById('chat-messages');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = \`Error: \${message}\`;
        chatMessages.appendChild(errorDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SimpleAIChat();
});`;
}