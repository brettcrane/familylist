/** List type enum matching backend */
export type ListType = 'grocery' | 'packing' | 'tasks';

/** Magnitude (effort sizing) for items */
export type Magnitude = 'S' | 'M' | 'L';

/** Priority levels for task items */
export type Priority = 'urgent' | 'high' | 'medium' | 'low';

/** Units of measure for item quantities */
export type Unit =
  | 'each' | 'dozen'
  | 'tsp' | 'tbsp' | 'fl oz' | 'cup' | 'pint' | 'quart' | 'gallon' | 'ml' | 'L'
  | 'oz' | 'lb' | 'g' | 'kg'
  | 'can' | 'bottle' | 'jar' | 'bag' | 'box' | 'pkg'
  | 'bunch' | 'clove' | 'pinch';

/** Status values for task items */
export type ItemStatus = 'open' | 'in_progress' | 'done' | 'blocked';

/** User response from API */
export interface User {
  id: string;
  clerk_user_id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
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
  unit: Unit | null;
  notes: string | null;
  magnitude: Magnitude | null;
  is_checked: boolean;
  checked_by: string | null;
  checked_by_name: string | null;
  checked_at: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  priority: Priority | null;
  due_date: string | null;
  status: ItemStatus | null;
  created_by: string | null;
  created_by_name: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Item create request */
export interface ItemCreate {
  name: string;
  quantity?: number;
  unit?: Unit | null;
  notes?: string | null;
  category_id?: string | null;
  magnitude?: Magnitude | null;
  assigned_to?: string | null;
  priority?: Priority | null;
  due_date?: string | null;
  status?: ItemStatus | null;
}

/** Batch item create request */
export interface ItemBatchCreate {
  items: ItemCreate[];
}

/** Item update request */
export interface ItemUpdate {
  name?: string;
  quantity?: number;
  unit?: Unit | null;
  notes?: string | null;
  category_id?: string | null;
  magnitude?: Magnitude | null;
  assigned_to?: string | null;
  priority?: Priority | null;
  due_date?: string | null;
  status?: ItemStatus | null;
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
  owner_name: string | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
  item_count: number;
  checked_count: number;
  share_count?: number;
  is_shared?: boolean;
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

/** Share permission types */
export type SharePermission = 'view' | 'edit';

/** Share by email request */
export interface ShareByEmailRequest {
  email: string;
  permission: SharePermission;
}

/** Share with user response */
export interface ListShare {
  id: string;
  list_id: string;
  user: User;
  permission: SharePermission;
  created_at: string;
}

/** Update share permission request */
export interface ShareUpdateRequest {
  permission: SharePermission;
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

/** Parsed item from NL parsing */
export interface ParsedItem {
  name: string;
  category: string;
  quantity: number;
  unit: string;
}

/** AI parse request for natural language */
export interface ParseRequest {
  input: string;
  list_type: ListType;
}

/** AI extract-url request for recipe ingredient extraction */
export interface ExtractUrlRequest {
  url: string;
  list_type: ListType;
}

/** AI parse response with multiple items */
export interface ParseResponse {
  original_input: string;
  items: ParsedItem[];
  confidence: number;
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
  tasks: ['Health', 'Home', 'Finance', 'Family', 'Work'],
};

/** AI mode placeholder text by list type */
export const AI_MODE_PLACEHOLDERS: Record<ListType, string> = {
  grocery: "What's cooking? (e.g., tacos)",
  packing: 'Packing for...? (e.g., beach trip)',
  tasks: 'What needs doing? (e.g., hang a picture)',
};

/** AI mode hint text by list type */
export const AI_MODE_HINTS: Record<ListType, string> = {
  grocery: 'AI will suggest ingredients for your dish',
  packing: 'AI will suggest items to pack',
  tasks: 'AI will break this into tasks',
};

/** Unit display labels */
export const UNIT_LABELS: Record<Unit, string> = {
  each: 'Each',
  dozen: 'Dozen',
  tsp: 'Teaspoon',
  tbsp: 'Tablespoon',
  'fl oz': 'Fluid Ounce',
  cup: 'Cup',
  pint: 'Pint',
  quart: 'Quart',
  gallon: 'Gallon',
  ml: 'Milliliter',
  L: 'Liter',
  oz: 'Ounce',
  lb: 'Pound',
  g: 'Gram',
  kg: 'Kilogram',
  can: 'Can',
  bottle: 'Bottle',
  jar: 'Jar',
  bag: 'Bag',
  box: 'Box',
  pkg: 'Package',
  bunch: 'Bunch',
  clove: 'Clove',
  pinch: 'Pinch',
};

/** Unit dropdown options */
export const UNIT_OPTIONS: { value: Unit; label: string; group: string }[] = [
  { value: 'each', label: 'Each', group: 'Count' },
  { value: 'dozen', label: 'Dozen', group: 'Count' },
  { value: 'tsp', label: 'Teaspoon', group: 'Volume' },
  { value: 'tbsp', label: 'Tablespoon', group: 'Volume' },
  { value: 'fl oz', label: 'Fluid Ounce', group: 'Volume' },
  { value: 'cup', label: 'Cup', group: 'Volume' },
  { value: 'pint', label: 'Pint', group: 'Volume' },
  { value: 'quart', label: 'Quart', group: 'Volume' },
  { value: 'gallon', label: 'Gallon', group: 'Volume' },
  { value: 'ml', label: 'Milliliter', group: 'Volume' },
  { value: 'L', label: 'Liter', group: 'Volume' },
  { value: 'oz', label: 'Ounce', group: 'Weight' },
  { value: 'lb', label: 'Pound', group: 'Weight' },
  { value: 'g', label: 'Gram', group: 'Weight' },
  { value: 'kg', label: 'Kilogram', group: 'Weight' },
  { value: 'can', label: 'Can', group: 'Container' },
  { value: 'bottle', label: 'Bottle', group: 'Container' },
  { value: 'jar', label: 'Jar', group: 'Container' },
  { value: 'bag', label: 'Bag', group: 'Container' },
  { value: 'box', label: 'Box', group: 'Container' },
  { value: 'pkg', label: 'Package', group: 'Container' },
  { value: 'bunch', label: 'Bunch', group: 'Other' },
  { value: 'clove', label: 'Clove', group: 'Other' },
  { value: 'pinch', label: 'Pinch', group: 'Other' },
];

/** Format quantity + unit for display */
export function formatQuantityUnit(quantity: number, unit?: Unit | string | null): string {
  if (!unit || unit === 'each') {
    return quantity !== 1 ? `×${Number.isInteger(quantity) ? quantity : quantity.toFixed(1)}` : '';
  }
  const qtyStr = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.?0+$/, '');
  return `${qtyStr} ${unit}`;
}

/** Shared shape for badge/pill display config (magnitude, priority, status) */
export interface BadgeConfig {
  label: string;
  textClass: string;
  bgClass: string;
}

/** Magnitude display configuration */
export const MAGNITUDE_CONFIG: Record<Magnitude, BadgeConfig> = {
  S: {
    label: 'Small',
    textClass: 'text-[var(--color-text-muted)]',
    bgClass: 'bg-[var(--color-bg-secondary)]',
  },
  M: {
    label: 'Medium',
    textClass: 'text-[var(--color-pending)]',
    bgClass: 'bg-[var(--color-pending)]/15',
  },
  L: {
    label: 'Large',
    textClass: 'text-[var(--color-destructive)]',
    bgClass: 'bg-[var(--color-destructive)]/15',
  },
};

/** Magnitude dropdown options (derived from MAGNITUDE_CONFIG) */
export const MAGNITUDE_OPTIONS: { value: Magnitude | null; label: string }[] = [
  { value: null, label: 'None' },
  ...(['S', 'M', 'L'] as Magnitude[]).map(m => ({ value: m, label: MAGNITUDE_CONFIG[m].label })),
];

/**
 * Priority display configuration.
 *
 * Uses Tailwind dark: variants for priority-specific colors (red, orange, yellow,
 * green) that don't have existing CSS custom properties.
 */
export const PRIORITY_CONFIG: Record<Priority, BadgeConfig> = {
  urgent: { label: 'Urgent', textClass: 'text-red-600 dark:text-red-400', bgClass: 'bg-red-100 dark:bg-red-900/30' },
  high:   { label: 'High',   textClass: 'text-orange-600 dark:text-orange-400', bgClass: 'bg-orange-100 dark:bg-orange-900/30' },
  medium: { label: 'Medium', textClass: 'text-yellow-600 dark:text-yellow-400', bgClass: 'bg-yellow-100 dark:bg-yellow-900/30' },
  low:    { label: 'Low',    textClass: 'text-green-600 dark:text-green-400', bgClass: 'bg-green-100 dark:bg-green-900/30' },
};

/** Priority dropdown options (derived from PRIORITY_CONFIG) */
export const PRIORITY_OPTIONS: { value: Priority | null; label: string }[] = [
  { value: null, label: 'None' },
  ...(['urgent', 'high', 'medium', 'low'] as Priority[]).map(p => ({ value: p, label: PRIORITY_CONFIG[p].label })),
];

/** Status display configuration */
export const STATUS_CONFIG: Record<ItemStatus, BadgeConfig> = {
  open:        { label: 'Open',        textClass: 'text-[var(--color-text-muted)]', bgClass: 'bg-[var(--color-bg-secondary)]' },
  in_progress: { label: 'In Progress', textClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-100 dark:bg-blue-900/30' },
  done:        { label: 'Done',        textClass: 'text-green-600 dark:text-green-400', bgClass: 'bg-green-100 dark:bg-green-900/30' },
  blocked:     { label: 'Blocked',     textClass: 'text-red-600 dark:text-red-400', bgClass: 'bg-red-100 dark:bg-red-900/30' },
};

/** Status dropdown options (derived from STATUS_CONFIG) */
export const STATUS_OPTIONS: { value: ItemStatus | null; label: string }[] = [
  { value: null, label: 'None' },
  ...(['open', 'in_progress', 'done', 'blocked'] as ItemStatus[]).map(s => ({ value: s, label: STATUS_CONFIG[s].label })),
];

/**
 * Well-known user ID for items created by Claude AI via Cowork MCP.
 * IMPORTANT: Must match CLAUDE_SYSTEM_USER_ID in backend/app/models.py.
 */
export const CLAUDE_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

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

