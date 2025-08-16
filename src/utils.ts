import { Env, Session, RateLimit } from './types';

// Generate a random session ID
export function generateSessionId(): string {
  return crypto.randomUUID();
}

// Get current timestamp in ISO format
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// Create a new session
export async function createSession(env: Env, userAgent?: string): Promise<Session> {
  const sessionId = generateSessionId();
  const now = getCurrentTimestamp();
  
  const session: Session = {
    session_id: sessionId,
    user_id: sessionId, // For v1, user_id = session_id (no separate auth)
    created_at: now,
    last_activity: now,
    request_count: 0,
    daily_neurons_used: 0,
  };

  // Store session in KV with 24-hour TTL
  await env.SESSIONS_KV.put(sessionId, JSON.stringify(session), {
    expirationTtl: 24 * 60 * 60, // 24 hours
  });

  return session;
}

// Get session from KV
export async function getSession(env: Env, sessionId: string): Promise<Session | null> {
  const sessionData = await env.SESSIONS_KV.get(sessionId);
  if (!sessionData) {
    return null;
  }
  
  try {
    return JSON.parse(sessionData) as Session;
  } catch (error) {
    console.error('Error parsing session data:', error);
    return null;
  }
}

// Update session activity
export async function updateSessionActivity(env: Env, session: Session): Promise<void> {
  session.last_activity = getCurrentTimestamp();
  session.request_count += 1;

  await env.SESSIONS_KV.put(session.session_id, JSON.stringify(session), {
    expirationTtl: 24 * 60 * 60, // 24 hours
  });
}

// Rate limiting configuration
export const RATE_LIMITS: RateLimit = {
  requests_per_hour: 100,
  requests_per_day: 1000,
  neurons_per_day: 10000, // Cloudflare AI free tier limit
};

// Check if request should be rate limited
export async function checkRateLimit(env: Env, session: Session): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = new Date();
  const hourKey = `rate_limit:${session.session_id}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  const dayKey = `rate_limit:${session.session_id}:${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  // Check hourly limit
  const hourlyRequests = await env.SESSIONS_KV.get(hourKey);
  const hourlyCount = hourlyRequests ? parseInt(hourlyRequests) : 0;
  
  if (hourlyCount >= RATE_LIMITS.requests_per_hour) {
    return { allowed: false, retryAfter: 3600 - (now.getMinutes() * 60 + now.getSeconds()) };
  }

  // Check daily limit
  const dailyRequests = await env.SESSIONS_KV.get(dayKey);
  const dailyCount = dailyRequests ? parseInt(dailyRequests) : 0;
  
  if (dailyCount >= RATE_LIMITS.requests_per_day) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return { allowed: false, retryAfter: Math.floor((tomorrow.getTime() - now.getTime()) / 1000) };
  }

  // Check daily neuron limit
  if (session.daily_neurons_used >= RATE_LIMITS.neurons_per_day) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return { allowed: false, retryAfter: Math.floor((tomorrow.getTime() - now.getTime()) / 1000) };
  }

  // Update counters
  await env.SESSIONS_KV.put(hourKey, (hourlyCount + 1).toString(), {
    expirationTtl: 3600, // 1 hour
  });
  
  await env.SESSIONS_KV.put(dayKey, (dailyCount + 1).toString(), {
    expirationTtl: 24 * 60 * 60, // 24 hours
  });

  return { allowed: true };
}

// Update neuron usage for session
export async function updateNeuronUsage(env: Env, session: Session, neuronsUsed: number): Promise<void> {
  session.daily_neurons_used += neuronsUsed;
  await env.SESSIONS_KV.put(session.session_id, JSON.stringify(session), {
    expirationTtl: 24 * 60 * 60, // 24 hours
  });
}

// Validate and sanitize user input
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters and limit length
  return input
    .replace(/[<>]/g, '') // Remove HTML-like tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim()
    .slice(0, 4000); // Limit to 4000 characters
}

// Validate model name - now accepts any Cloudflare model format
export function isValidModel(model: string): boolean {
  console.log('[utils] Checking model:', model);
  
  // Very simple validation - just ensure it starts with @cf/ or @hf/ and has reasonable format
  const isCloudflareModel = model.startsWith('@cf/') || model.startsWith('@hf/');
  const hasSlashes = (model.match(/\//g) || []).length >= 1; // At least one slash
  const notTooShort = model.length > 5;
  const notTooLong = model.length < 100;
  
  console.log('[utils] Is Cloudflare/HF model:', isCloudflareModel);
  console.log('[utils] Has slashes:', hasSlashes);
  console.log('[utils] Length check:', notTooShort && notTooLong);
  
  const isValid = isCloudflareModel && hasSlashes && notTooShort && notTooLong;
  console.log('[utils] Model is valid:', isValid);
  return isValid;
}

// Create CORS headers
export function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID',
    'Access-Control-Max-Age': '86400',
  };
}

// Create JSON response with CORS headers
export function createJsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(),
    },
  });
}

// Handle CORS preflight requests
export function handleCorsOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}