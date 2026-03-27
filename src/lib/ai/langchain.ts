import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// ==== Model Configurations ====

/**
 * Model utama untuk general tasks
 * - gemini-2.0-flash: cepat, hemat biaya, dan cukup pintar untuk kebanyakan use case
 * - temperature 0.3: sedikit kreatif tapi tetap konsisten
 */
export const llm = new ChatGoogleGenerativeAI({
  model: 'gemini-3.1-flash-lite-preview',
  temperature: 0.3,
  maxOutputTokens: 1000,
});

/**
 * Model untuk tasks yang butuh akurasi tinggi
 * - Parsing structured data
 * - Keputusan penting
 * - temperature 0: deterministic, consistent output
 */
export const llmStrict = new ChatGoogleGenerativeAI({
  model: 'gemini-3.1-flash-lite-preview',
  temperature: 0,
  maxOutputTokens: 500,
});

/**
 * Model untuk streaming responses (chat)
 * - streaming: true untuk real-time typing effect
 */
export const llmStreaming = new ChatGoogleGenerativeAI({
  model: 'gemini-3.1-flash-lite-preview',
  temperature: 0.5,
  streaming: true,
  maxOutputTokens: 1500,
});

/**
 * Model untuk analytics yang kompleks
 * - Untuk cost efficiency, gemini-2.0-flash biasanya cukup
 */
export const llmAnalytics = new ChatGoogleGenerativeAI({
  model: 'gemini-3.1-flash-lite-preview',
  temperature: 0.2,
  maxOutputTokens: 2000,
});
