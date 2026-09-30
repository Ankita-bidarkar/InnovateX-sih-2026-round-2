'use strict';

/* ============================================================
   InnovateX Intelligence Engine — Local LLM Provider
   ai/providers/localLLMProvider.js

   Connects to a locally/self-hosted inference server
   (Ollama, LM Studio, or any OpenAI-compatible endpoint).
   Falls back gracefully if not available.
   ============================================================ */

const LOCAL_AI_ENDPOINT  = process.env.LOCAL_AI_ENDPOINT  || '';
const LOCAL_AI_MODEL     = process.env.LOCAL_AI_MODEL     || 'llama3';
const LOCAL_AI_TIMEOUT   = parseInt(process.env.LOCAL_AI_TIMEOUT  || '30000');
const LOCAL_AI_MAX_TOKENS = parseInt(process.env.LOCAL_AI_MAX_CONTEXT || '2048');

let _available = null; // cached availability check

/**
 * Check whether the local LLM endpoint is reachable.
 * Caches result for 60 seconds.
 */
async function isAvailable() {
  if (!LOCAL_AI_ENDPOINT) return false;
  
  // Cache for 60s to avoid hammering
  if (_available !== null && _available._cachedAt && Date.now() - _available._cachedAt < 60000) {
    return _available.result;
  }

  try {
    // Try OpenAI-compatible /models endpoint (works with Ollama, LM Studio, etc.)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const url = `${LOCAL_AI_ENDPOINT.replace(/\/$/, '')}/api/tags`;
    const response = await fetch(url, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeout);

    // Also try /v1/models (OpenAI-compatible)
    if (!response || !response.ok) {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 3000);
      const r2 = await fetch(`${LOCAL_AI_ENDPOINT.replace(/\/$/, '')}/v1/models`, { signal: controller2.signal }).catch(() => null);
      clearTimeout(timeout2);
      const result = !!(r2 && r2.ok);
      _available = { result, _cachedAt: Date.now() };
      return result;
    }

    const result = response.ok;
    _available = { result, _cachedAt: Date.now() };
    return result;
  } catch {
    _available = { result: false, _cachedAt: Date.now() };
    return false;
  }
}

/**
 * Generate text using the local LLM.
 * Uses OpenAI-compatible chat completions endpoint.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {Object} options
 */
async function generate(systemPrompt, userMessage, options = {}) {
  if (!LOCAL_AI_ENDPOINT) {
    throw new Error('LOCAL_AI_ENDPOINT not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCAL_AI_TIMEOUT);

  try {
    // Try OpenAI-compatible chat completions (Ollama, LM Studio, etc.)
    const baseUrl = LOCAL_AI_ENDPOINT.replace(/\/$/, '');
    
    // Detect Ollama vs OpenAI-compatible
    const isOllama = baseUrl.includes('11434') || baseUrl.endsWith(':11434');
    
    let response;
    
    if (isOllama) {
      // Ollama native API
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || LOCAL_AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          stream: false,
          options: {
            num_predict: options.maxTokens || LOCAL_AI_MAX_TOKENS,
            temperature: options.temperature || 0.3,
          },
        }),
        signal: controller.signal,
      });
      
      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      const data = await response.json();
      return data.message?.content || '';
      
    } else {
      // OpenAI-compatible API (LM Studio, vLLM, etc.)
      response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model || LOCAL_AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: options.maxTokens || LOCAL_AI_MAX_TOKENS,
          temperature: options.temperature || 0.3,
        }),
        signal: controller.signal,
      });
      
      if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    }

  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Enhance an explanation using the local LLM.
 * If unavailable, return the base explanation as-is.
 * @param {string} baseExplanation — from explanationEngine (scores unchanged)
 * @param {string} context — additional structured context
 * @returns {string} enhanced or original explanation
 */
async function enhanceExplanation(baseExplanation, context = '') {
  const available = await isAvailable();
  if (!available) return baseExplanation;

  const systemPrompt = `You are Ask IX, the InnovateX Intelligence assistant. Your role is to make structured analysis results clearer and more readable for decision-makers.

IMPORTANT RULES:
- Do NOT change any scores, rankings, or recommendations
- Do NOT add information not present in the provided context
- Do NOT make procurement decisions or final recommendations
- Keep explanations concise (2-4 sentences)
- Use a professional, clear tone
- Focus on making the information understandable`;

  const userMessage = `Please rephrase the following analysis result to be clearer and more readable for a procurement decision-maker. Do not change any facts, numbers, or conclusions.

Base explanation: ${baseExplanation}
${context ? `Additional context: ${context}` : ''}

Provide a clear, 2-3 sentence explanation.`;

  try {
    const enhanced = await generate(systemPrompt, userMessage, { maxTokens: 300, temperature: 0.2 });
    return enhanced.trim() || baseExplanation;
  } catch {
    return baseExplanation;
  }
}

module.exports = { isAvailable, generate, enhanceExplanation, LOCAL_AI_MODEL, LOCAL_AI_ENDPOINT };
