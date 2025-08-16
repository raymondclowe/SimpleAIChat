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
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCorsOptions();
    }

    // Health check endpoint (no authentication required)
    if (url.pathname === '/api/health') {
      return handleHealthCheck(request, env);
    }

    // Serve static assets
    if (!url.pathname.startsWith('/api/')) {
      return await handleStaticAssets(request, env);
    }

    // All API endpoints require session management
    const session = await handleSessionAuth(request, env);
    if (!session.success) {
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

    // Update session activity
    await updateSessionActivity(env, session.session);

    // Route API requests
    try {
      switch (url.pathname) {
        case '/api/chat':
          if (request.method === 'POST') {
            return handleChatRequest(request, env, session.session);
          }
          break;

        case '/api/config':
          if (request.method === 'GET') {
            return handleConfigGet(request, env, session.session);
          } else if (request.method === 'PUT') {
            return handleConfigPut(request, env, session.session);
          }
          break;

        case '/api/history':
          if (request.method === 'GET') {
            return handleHistoryGet(request, env, session.session);
          }
          break;

        case '/api/usage':
          if (request.method === 'GET') {
            return handleUsageRequest(request, env, session.session);
          }
          break;

        default:
          return createJsonResponse({
            success: false,
            error: {
              error: 'not_found',
              message: 'Endpoint not found',
            },
          }, 404);
      }

      // Method not allowed
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
  },
};

async function handleSessionAuth(request: Request, env: Env): Promise<{ success: boolean; session?: any; response?: Response }> {
  const sessionHeader = request.headers.get('X-Session-ID');
  
  if (sessionHeader) {
    // Try to get existing session
    const session = await getSession(env, sessionHeader);
    if (session) {
      return { success: true, session };
    }
  }

  // Create new session
  try {
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const newSession = await createSession(env, userAgent);
    
    // Return session ID in response headers for client to store
    const response = createJsonResponse({
      success: true,
      session_id: newSession.session_id,
      message: 'New session created',
    });
    
    response.headers.set('X-Session-ID', newSession.session_id);
    
    return { 
      success: false, // Return false to send session creation response
      response 
    };
  } catch (error) {
    console.error('Error creating session:', error);
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
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Serve index.html for root path and SPA routes
  if (pathname === '/' || (!pathname.includes('.') && !pathname.startsWith('/api/'))) {
    pathname = '/index.html';
  }

  try {
    // In production, this would serve from the configured static assets
    // For now, we'll return the HTML content directly
    if (pathname === '/index.html') {
      return new Response(getIndexHTML(), {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=3600',
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
  } catch (error) {
    console.error('Error serving static asset:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

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
                    <select id="model-select">
                        <option value="@cf/meta/llama-3.1-8b-instruct">Llama 3.1 8B (Fast)</option>
                        <option value="@cf/meta/llama-3.1-70b-instruct">Llama 3.1 70B (Smart)</option>
                        <option value="@cf/microsoft/phi-2">Phi-2 (Coding)</option>
                        <option value="@cf/mistral/mistral-7b-instruct-v0.1">Mistral 7B</option>
                    </select>
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
        this.sessionId = localStorage.getItem('sessionId');
        this.isLoading = false;
        this.initializeApp();
        this.loadUsageStats();
        this.loadChatHistory();
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