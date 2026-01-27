/** List type enum matching backend */
export type ListType = 'grocery' | 'packing' | 'tasks';

/** User response from API */
export interface User {
  id: string;
  ha_user_id: string;
  display_name: string;
  created_at: string;
}

/** Category response from API */
export interface Category {
  id: string;
  list_id: string;
  name: string;
  sort_order: number;
}

/** Category create request */
export interface CategoryCreate {
  name: string;
  sort_order?: number;
}

/** Category update request */
export interface CategoryUpdate {
  name?: string;
  sort_order?: number;
}

/** Item response from API */
export interface Item {
  id: string;
  list_id: string;
  category_id: string | null;
  name: string;
  quantity: number;
  notes: string | null;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Item create request */
export interface ItemCreate {
  name: string;
  quantity?: number;
  notes?: string | null;
  category_id?: string | null;
}

/** Batch item create request */
export interface ItemBatchCreate {
  items: ItemCreate[];
}

/** Item update request */
export interface ItemUpdate {
  name?: string;
  quantity?: number;
  notes?: string | null;
  category_id?: string | null;
  sort_order?: number;
}

/** Item check request */
export interface ItemCheckRequest {
  user_id?: string | null;
}

/** List response from API (without items) */
export interface List {
  id: string;
  name: string;
  type: ListType;
  icon: string | null;
  color: string | null;
  owner_id: string | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

/** List response with items and categories */
export interface ListWithItems extends List {
  categories: Category[];
  items: Item[];
}

/** List create request */
export interface ListCreate {
  name: string;
  type: ListType;
  icon?: string | null;
  color?: string | null;
  owner_id?: string | null;
}

/** List update request */
export interface ListUpdate {
  name?: string;
  icon?: string | null;
  color?: string | null;
}

/** List duplicate request */
export interface ListDuplicateRequest {
  name: string;
  as_template?: boolean;
}

/** AI categorize request */
export interface CategorizeRequest {
  item_name: string;
  list_type: ListType;
}

/** AI categorize response */
export interface CategorizeResponse {
  category: string;
  confidence: number;
}

/** AI feedback request */
export interface FeedbackRequest {
  item_name: string;
  list_type: ListType;
  correct_category: string;
}

/** AI feedback response */
export interface FeedbackResponse {
  message: string;
  item_name_normalized: string;
}

/** Health check response */
export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
}

/** Standard error response */
export interface ErrorResponse {
  detail: string;
}

/** Default categories by list type */
export const DEFAULT_CATEGORIES: Record<ListType, string[]> = {
  grocery: [
    'Produce',
    'Dairy',
    'Meat & Seafood',
    'Bakery',
    'Pantry',
    'Frozen',
    'Beverages',
    'Snacks',
    'Household',
    'Personal Care',
  ],
  packing: [
    'Clothing',
    'Toiletries',
    'Electronics',
    'Documents',
    "Kids' Items",
    'Miscellaneous',
  ],
  tasks: ['Today', 'This Week', 'Later'],
};

/** Category color mapping */
export const CATEGORY_COLORS: Record<string, string> = {
  Produce: 'var(--color-cat-produce)',
  Dairy: 'var(--color-cat-dairy)',
  'Meat & Seafood': 'var(--color-cat-meat)',
  Bakery: 'var(--color-cat-bakery)',
  Frozen: 'var(--color-cat-frozen)',
  Pantry: 'var(--color-cat-pantry)',
  Beverages: 'var(--color-cat-beverages)',
  Snacks: 'var(--color-cat-snacks)',
  Household: 'var(--color-cat-household)',
  'Personal Care': 'var(--color-cat-personal)',
};

/** List type icons */
export const LIST_TYPE_ICONS: Record<ListType, string> = {
  grocery: '🛒',
  packing: '🧳',
  tasks: '✅',
};
