import { post } from './client';
import type {
  CategorizeRequest,
  CategorizeResponse,
  FeedbackRequest,
  FeedbackResponse,
  ParseRequest,
  ParseResponse,
} from '../types/api';

/**
 * Get AI category suggestion for an item
 */
export function categorizeItem(
  data: CategorizeRequest
): Promise<CategorizeResponse> {
  return post<CategorizeResponse>('/ai/categorize', data);
}

/**
 * Submit feedback when user corrects a category
 */
export function submitFeedback(data: FeedbackRequest): Promise<FeedbackResponse> {
  return post<FeedbackResponse>('/ai/feedback', data);
}

/**
 * Parse natural language input into multiple items
 * Returns 503 error if LLM service is not available
 */
export function parseNaturalLanguage(data: ParseRequest): Promise<ParseResponse> {
  return post<ParseResponse>('/ai/parse', data);
}
