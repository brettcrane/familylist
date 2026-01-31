/**
 * Centralized icons for the app.
 * - List types: Heroicons (professional UI icons)
 * - Categories: Emojis (universally recognized for products)
 */
import {
  ShoppingCartIcon,
  BriefcaseIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import type { ListType } from '../../types/api';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

// =============================================================================
// List Type Icons (Heroicons)
// =============================================================================

const LIST_TYPE_ICON_MAP: Record<ListType, IconComponent> = {
  grocery: ShoppingCartIcon,
  packing: BriefcaseIcon,
  tasks: CheckCircleIcon,
};

export function ListTypeIcon({ type, className = 'w-5 h-5', style }: { type: ListType } & IconProps) {
  const Icon = LIST_TYPE_ICON_MAP[type];
  return <Icon className={className} style={style} />;
}

export function getListTypeIconComponent(type: ListType): IconComponent {
  return LIST_TYPE_ICON_MAP[type];
}

// =============================================================================
// Category Emojis (centralized mapping)
// =============================================================================

const CATEGORY_EMOJI_MAP: Record<string, string> = {
  // Grocery categories
  Produce: '🥬',
  Dairy: '🥛',
  'Meat & Seafood': '🥩',
  Bakery: '🍞',
  Pantry: '🥫',
  Frozen: '🧊',
  Beverages: '🥤',
  Snacks: '🍪',
  Household: '🧹',
  'Personal Care': '🧴',
  Other: '📦',
  // Packing categories
  Clothing: '👕',
  Toiletries: '🧼',
  Electronics: '📱',
  Documents: '📄',
  Accessories: '👜',
  "Kids' Items": '🧸',
  Miscellaneous: '📦',
  // Task categories
  'High Priority': '🔴',
  Normal: '🟡',
  'Low Priority': '🟢',
  Today: '📅',
  'This Week': '📆',
  Later: '⏰',
  // Fallback
  Uncategorized: '❓',
};

const DEFAULT_EMOJI = '📝';

export function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJI_MAP[category] || DEFAULT_EMOJI;
}
