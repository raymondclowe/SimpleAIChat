import { Env, ChatRequest, ChatResponse, ChatError, ChatMessage, AIModel, UsageStats } from './types';
import { 
  sanitizeInput, 
  isValidModel, 
  createJsonResponse, 
  updateNeuronUsage, 
  getCurrentTimestamp 
} from './utils';

// Available Cloudflare AI models
export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    description: 'Fast and efficient model for general conversations',
    max_tokens: 2048,
    cost_per_token: 0.000011,
    available: true,
  },
  {
    id: '@cf/meta/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    description: 'Large model with superior reasoning capabilities',
    max_tokens: 4096,
    cost_per_token: 0.000055,
    available: true,
  },
  {
    id: '@cf/microsoft/phi-2',
    name: 'Microsoft Phi-2',
    description: 'Compact model optimized for coding tasks',
    max_tokens: 1024,
    cost_per_token: 0.000008,
    available: true,
  },
  {
    id: '@cf/mistral/mistral-7b-instruct-v0.1',
    name: 'Mistral 7B Instruct',
    description: 'Balanced model for instruction following',
    max_tokens: 2048,
    cost_per_token: 0.000012,
    available: true,
  },
];

export async function handleChatRequest(request: Request, env: Env, session: any): Promise<Response> {
  try {
    const body = await request.json() as ChatRequest;
    
    // Sanitize and validate input
    const message = sanitizeInput(body.message);
    if (!message || message.length === 0) {
      const error: ChatError = {
        error: 'invalid_input',
        message: 'Message cannot be empty',
      };
      return createJsonResponse({ success: false, error }, 400);
    }

    // Validate model
    const model = body.model || '@cf/meta/llama-3.1-8b-instruct';
    if (!isValidModel(model)) {
      const error: ChatError = {
        error: 'invalid_model',
        message: 'Selected model is not available',
      };
      return createJsonResponse({ success: false, error }, 400);
    }

    // Prepare context for AI model
    const context = body.context || [];
    const maxTokens = Math.min(body.max_tokens || 150, 2048);

    // Build conversation context
    let conversationContext = '';
    if (context.length > 0) {
      conversationContext = context.join('\n') + '\n';
    }
    conversationContext += `Human: ${message}\nAssistant:`;

    // Call Cloudflare AI API
    const aiResponse = await callCloudflareAI(env, model, conversationContext, maxTokens);
    
    if (!aiResponse.success || !aiResponse.response) {
      return createJsonResponse({ success: false, error: aiResponse.error }, 500);
    }

    // Estimate neuron usage (rough calculation)
    const neuronsUsed = estimateNeuronUsage(message, aiResponse.response, model);
    
    // Update session neuron usage
    await updateNeuronUsage(env, session, neuronsUsed);

    // Save chat message to history
    await saveChatMessage(env, session.session_id, message, aiResponse.response, model, neuronsUsed);

    // Prepare response
    const response: ChatResponse = {
      response: aiResponse.response,
      usage: {
        neurons_used: neuronsUsed,
        remaining_quota: Math.max(0, 10000 - session.daily_neurons_used),
      },
      model_used: model,
      timestamp: getCurrentTimestamp(),
    };

    return createJsonResponse({ success: true, data: response });

  } catch (error) {
    console.error('Error handling chat request:', error);
    const errorResponse: ChatError = {
      error: 'internal_error',
      message: 'An internal error occurred while processing your request',
    };
    return createJsonResponse({ success: false, error: errorResponse }, 500);
  }
}

interface CloudflareAIResult {
  success: boolean;
  result?: {
    response: string;
  };
}

async function callCloudflareAI(env: Env, model: string, prompt: string, maxTokens: number): Promise<{ success: boolean; response?: string; error?: ChatError }> {
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.COPILOT_CLOUDFLARE_GLOBAL}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: prompt,
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('Cloudflare AI API error:', response.status, await response.text());
      return {
        success: false,
        error: {
          error: 'ai_api_error',
          message: 'Failed to get response from AI model',
        },
      };
    }

    const result = await response.json() as CloudflareAIResult;
    
    if (result.success && result.result && result.result.response) {
      return {
        success: true,
        response: result.result.response.trim(),
      };
    } else {
      return {
        success: false,
        error: {
          error: 'ai_response_error',
          message: 'Invalid response from AI model',
        },
      };
    }

  } catch (error) {
    console.error('Error calling Cloudflare AI:', error);
    return {
      success: false,
      error: {
        error: 'ai_request_failed',
        message: 'Failed to connect to AI service',
      },
    };
  }
}

function estimateNeuronUsage(userMessage: string, aiResponse: string, model: string): number {
  // Rough estimation based on token count
  const inputTokens = Math.ceil(userMessage.length / 4); // ~4 chars per token
  const outputTokens = Math.ceil(aiResponse.length / 4);
  
  // Different models have different neuron costs
  let multiplier = 1;
  if (model.includes('70b')) {
    multiplier = 5; // 70B model uses more neurons
  } else if (model.includes('phi-2')) {
    multiplier = 0.7; // Phi-2 is more efficient
  }

  return Math.ceil((inputTokens + outputTokens) * multiplier);
}

async function saveChatMessage(env: Env, sessionId: string, userMessage: string, aiResponse: string, model: string, neuronsUsed: number): Promise<void> {
  try {
    const timestamp = getCurrentTimestamp();
    
    // Create message objects
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp,
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: aiResponse,
      timestamp,
      model_used: model,
      neurons_used: neuronsUsed,
    };

    // Get existing history or create new
    const historyKey = `history:${sessionId}`;
    const existingHistory = await env.CHAT_HISTORY_KV.get(historyKey);
    
    let messages: ChatMessage[] = [];
    if (existingHistory) {
      try {
        const parsed = JSON.parse(existingHistory);
        messages = parsed.messages || [];
      } catch (error) {
        console.error('Error parsing existing history:', error);
      }
    }

    // Add new messages
    messages.push(userMsg, assistantMsg);

    // Keep only last 50 messages to manage storage
    if (messages.length > 50) {
      messages = messages.slice(-50);
    }

    // Save updated history
    const historyData = {
      messages,
      total_messages: messages.length,
      session_id: sessionId,
      created_at: existingHistory ? JSON.parse(existingHistory).created_at : timestamp,
      updated_at: timestamp,
    };

    await env.CHAT_HISTORY_KV.put(historyKey, JSON.stringify(historyData));

  } catch (error) {
    console.error('Error saving chat message:', error);
    // Don't throw error to avoid breaking the chat flow
  }
}

export async function handleUsageRequest(request: Request, env: Env, session: any): Promise<Response> {
  try {
    const usageStats: UsageStats = {
      session_id: session.session_id,
      daily_requests: session.request_count,
      daily_neurons_used: session.daily_neurons_used,
      quota_limit: 10000, // Cloudflare AI free tier limit
      quota_reset_time: getNextMidnightUTC(),
      rate_limit_remaining: Math.max(0, 100 - (session.request_count % 100)),
    };

    return createJsonResponse({ success: true, data: usageStats });
  } catch (error) {
    console.error('Error handling usage request:', error);
    return createJsonResponse({ 
      success: false, 
      error: { error: 'internal_error', message: 'Failed to retrieve usage stats' }
    }, 500);
  }
}

function getNextMidnightUTC(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

