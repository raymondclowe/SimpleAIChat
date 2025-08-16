import { Env, UserConfig, ChatHistory, HealthStatus } from './types';
import { createJsonResponse, sanitizeInput, getCurrentTimestamp } from './utils';
import { AVAILABLE_MODELS } from './ai-handler';

// Default user configuration
const DEFAULT_CONFIG: UserConfig = {
  selected_model: '@cf/meta/llama-3.1-8b-instruct',
  mcp_endpoints: [],
  ui_preferences: {
    theme: 'light',
    max_context_messages: 10,
  },
  created_at: getCurrentTimestamp(),
  updated_at: getCurrentTimestamp(),
};

export async function handleConfigGet(request: Request, env: Env, session: any): Promise<Response> {
  try {
    const configKey = `config:${session.session_id}`;
    const configData = await env.CONFIG_KV.get(configKey);
    
    let config: UserConfig;
    if (configData) {
      try {
        config = JSON.parse(configData);
      } catch (error) {
        console.error('Error parsing config data:', error);
        config = DEFAULT_CONFIG;
      }
    } else {
      config = DEFAULT_CONFIG;
    }

    return createJsonResponse({ success: true, data: config });
  } catch (error) {
    console.error('Error handling config get request:', error);
    return createJsonResponse({ 
      success: false, 
      error: { error: 'internal_error', message: 'Failed to retrieve configuration' }
    }, 500);
  }
}

export async function handleConfigPut(request: Request, env: Env, session: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    
    // Get existing config
    const configKey = `config:${session.session_id}`;
    const existingConfigData = await env.CONFIG_KV.get(configKey);
    let existingConfig: UserConfig = DEFAULT_CONFIG;
    
    if (existingConfigData) {
      try {
        existingConfig = JSON.parse(existingConfigData);
      } catch (error) {
        console.error('Error parsing existing config:', error);
      }
    }

    // Update config with new values
    const updatedConfig: UserConfig = {
      ...existingConfig,
      updated_at: getCurrentTimestamp(),
    };

    // Validate and update selected model
    if (body.selected_model && typeof body.selected_model === 'string') {
      const modelExists = AVAILABLE_MODELS.some(model => model.id === body.selected_model);
      if (modelExists) {
        updatedConfig.selected_model = body.selected_model;
      }
    }

    // Validate and update MCP endpoints
    if (body.mcp_endpoints && Array.isArray(body.mcp_endpoints)) {
      updatedConfig.mcp_endpoints = body.mcp_endpoints
        .filter((endpoint: any) => typeof endpoint === 'string')
        .map((endpoint: string) => sanitizeInput(endpoint))
        .filter((endpoint: string) => isValidUrl(endpoint))
        .slice(0, 10); // Limit to 10 endpoints
    }

    // Update UI preferences
    if (body.ui_preferences && typeof body.ui_preferences === 'object') {
      if (body.ui_preferences.theme && ['light', 'dark'].includes(body.ui_preferences.theme)) {
        updatedConfig.ui_preferences.theme = body.ui_preferences.theme;
      }
      
      if (body.ui_preferences.max_context_messages && 
          typeof body.ui_preferences.max_context_messages === 'number' &&
          body.ui_preferences.max_context_messages >= 1 &&
          body.ui_preferences.max_context_messages <= 50) {
        updatedConfig.ui_preferences.max_context_messages = body.ui_preferences.max_context_messages;
      }
    }

    // Save updated config
    await env.CONFIG_KV.put(configKey, JSON.stringify(updatedConfig));

    return createJsonResponse({ success: true, data: updatedConfig });
  } catch (error) {
    console.error('Error handling config put request:', error);
    return createJsonResponse({ 
      success: false, 
      error: { error: 'internal_error', message: 'Failed to update configuration' }
    }, 500);
  }
}

export async function handleHistoryGet(request: Request, env: Env, session: any): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    
    const historyKey = `history:${session.session_id}`;
    const historyData = await env.CHAT_HISTORY_KV.get(historyKey);
    
    if (!historyData) {
      const emptyHistory: ChatHistory = {
        messages: [],
        total_messages: 0,
        session_id: session.session_id,
        created_at: getCurrentTimestamp(),
        updated_at: getCurrentTimestamp(),
      };
      return createJsonResponse({ success: true, data: emptyHistory });
    }

    try {
      const history = JSON.parse(historyData);
      
      // Implement pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedMessages = history.messages.slice(startIndex, endIndex);
      
      const paginatedHistory: ChatHistory = {
        messages: paginatedMessages,
        total_messages: history.messages.length,
        session_id: session.session_id,
        created_at: history.created_at,
        updated_at: history.updated_at,
      };

      return createJsonResponse({ success: true, data: paginatedHistory });
    } catch (error) {
      console.error('Error parsing history data:', error);
      return createJsonResponse({ 
        success: false, 
        error: { error: 'data_error', message: 'Failed to parse chat history' }
      }, 500);
    }
  } catch (error) {
    console.error('Error handling history get request:', error);
    return createJsonResponse({ 
      success: false, 
      error: { error: 'internal_error', message: 'Failed to retrieve chat history' }
    }, 500);
  }
}

export async function handleHealthCheck(request: Request, env: Env): Promise<Response> {
  try {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      services: {
        cloudflare_ai: 'up',
        kv_storage: 'up',
        mcp_endpoints: {},
      },
      timestamp: getCurrentTimestamp(),
      version: '1.0.0',
    };

    // Test KV storage
    try {
      await env.CONFIG_KV.put('health_check', getCurrentTimestamp(), { expirationTtl: 60 });
      const testValue = await env.CONFIG_KV.get('health_check');
      if (!testValue) {
        healthStatus.services.kv_storage = 'degraded';
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      console.error('KV health check failed:', error);
      healthStatus.services.kv_storage = 'down';
      healthStatus.status = 'degraded';
    }

    // Test Cloudflare AI (simple ping)
    try {
      const aiTestResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.COPILOT_CLOUDFLARE_GLOBAL}`,
        },
      });
      
      if (!aiTestResponse.ok) {
        healthStatus.services.cloudflare_ai = 'degraded';
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      console.error('Cloudflare AI health check failed:', error);
      healthStatus.services.cloudflare_ai = 'down';
      healthStatus.status = 'degraded';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    return createJsonResponse({ success: true, data: healthStatus }, statusCode);
  } catch (error) {
    console.error('Error handling health check:', error);
    const unhealthyStatus: HealthStatus = {
      status: 'unhealthy',
      services: {
        cloudflare_ai: 'down',
        kv_storage: 'down',
        mcp_endpoints: {},
      },
      timestamp: getCurrentTimestamp(),
      version: '1.0.0',
    };
    return createJsonResponse({ success: false, data: unhealthyStatus }, 503);
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}