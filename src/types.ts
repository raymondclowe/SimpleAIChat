// Environment bindings for Cloudflare Workers
export interface Env {
  CONFIG_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  CHAT_HISTORY_KV: KVNamespace;
  COPILOT_CLOUDFLARE_GLOBAL: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  ENVIRONMENT: string;
}

// Chat API types
export interface ChatRequest {
  message: string;
  model?: string;
  context?: string[];
  max_tokens?: number;
  session_id?: string;
}

export interface ChatResponse {
  response: string;
  usage: {
    neurons_used: number;
    remaining_quota: number;
  };
  model_used: string;
  timestamp: string;
}

export interface ChatError {
  error: string;
  message: string;
  retry_after?: number;
  usage?: {
    neurons_used: number;
    quota_limit: number;
  };
}

// Configuration types
export interface UserConfig {
  selected_model: string;
  mcp_endpoints: string[];
  ui_preferences: {
    theme: 'light' | 'dark';
    max_context_messages: number;
  };
  created_at: string;
  updated_at: string;
}

// Chat history types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model_used?: string;
  neurons_used?: number;
}

export interface ChatHistory {
  messages: ChatMessage[];
  total_messages: number;
  session_id: string;
  created_at: string;
  updated_at: string;
}

// Session management types
export interface Session {
  session_id: string;
  user_id: string;
  created_at: string;
  last_activity: string;
  request_count: number;
  daily_neurons_used: number;
}

// Usage tracking types
export interface UsageStats {
  session_id: string;
  daily_requests: number;
  daily_neurons_used: number;
  quota_limit: number;
  quota_reset_time: string;
  rate_limit_remaining: number;
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    cloudflare_ai: 'up' | 'down' | 'degraded';
    kv_storage: 'up' | 'down' | 'degraded';
    mcp_endpoints: { [url: string]: 'up' | 'down' | 'degraded' };
  };
  timestamp: string;
  version: string;
}

// Rate limiting types
export interface RateLimit {
  requests_per_hour: number;
  requests_per_day: number;
  neurons_per_day: number;
}

// Available AI models
export interface AIModel {
  id: string;
  name: string;
  description: string;
  max_tokens: number;
  cost_per_token: number;
  available: boolean;
}

// HTTP Response wrapper
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: ChatError;
  timestamp: string;
}