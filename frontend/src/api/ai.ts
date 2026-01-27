import { post } from './client';
import type {
  CategorizeRequest,
  CategorizeResponse,
  FeedbackRequest,
  FeedbackResponse,
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
