/**
 * Centralized icons for the app.
 * - List types: Heroicons (professional UI icons)
 * - Categories: Tabler Icons (consistent SVG category indicators)
 * - List icons: Tabler Icons (for list icon picker and display)
 */
import {
  ShoppingCartIcon,
  BriefcaseIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  IconApple,
  IconMilk,
  IconMeat,
  IconBread,
  IconBottle,
  IconSnowflake,
  IconCup,
  IconCookie,
  IconSpray,
  IconDroplet,
  IconPackage,
  IconShirt,
  IconDroplets,
  IconDeviceMobile,
  IconFileText,
  IconBackpack,
  IconHorseToy,
  IconAlertTriangle,
  IconFlag,
  IconArrowDown,
  IconCalendarEvent,
  IconCalendar,
  IconClock,
  IconQuestionMark,
  IconNote,
  // List icon picker
  IconShoppingCart,
  IconCircleCheck,
  IconHome,
  IconGift,
  IconStar,
  IconHeart,
  IconTarget,
  IconPinned,
  IconPencil,
  IconClipboardList,
} from '@tabler/icons-react';
import type { ComponentType, SVGProps } from 'react';
import type { IconProps as TablerIconProps } from '@tabler/icons-react';
import type { ListType } from '../../types/api';

type HeroIconComponent = ComponentType<SVGProps<SVGSVGElement>>;
type TablerIconComponent = ComponentType<TablerIconProps>;

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

// =============================================================================
// List Type Icons (Heroicons)
// =============================================================================

const LIST_TYPE_ICON_MAP: Record<ListType, HeroIconComponent> = {
  grocery: ShoppingCartIcon,
  packing: BriefcaseIcon,
  tasks: CheckCircleIcon,
};

export function ListTypeIcon({ type, className = 'w-5 h-5', style }: { type: ListType } & IconProps) {
  const Icon = LIST_TYPE_ICON_MAP[type];
  if (!Icon) {
    if (import.meta.env.DEV) {
      console.error(`[ListTypeIcon] Unknown list type "${type}"`);
    }
    return <CheckCircleIcon className={className} style={style} />;
  }
  return <Icon className={className} style={style} />;
}

// =============================================================================
// Category Icons (Tabler Icons)
// =============================================================================

const CATEGORY_ICON_MAP: Record<string, TablerIconComponent> = {
  // Grocery categories
  Produce: IconApple,
  Dairy: IconMilk,
  'Meat & Seafood': IconMeat,
  Bakery: IconBread,
  Pantry: IconBottle,
  Frozen: IconSnowflake,
  Beverages: IconCup,
  Snacks: IconCookie,
  Household: IconSpray,
  'Personal Care': IconDroplet,
  Other: IconPackage,
  // Packing categories
  Clothing: IconShirt,
  Toiletries: IconDroplets,
  Electronics: IconDeviceMobile,
  Documents: IconFileText,
  Accessories: IconBackpack,
  "Kids' Items": IconHorseToy,
  Miscellaneous: IconPackage,
  // Task categories
  'High Priority': IconAlertTriangle,
  Normal: IconFlag,
  'Low Priority': IconArrowDown,
  Today: IconCalendarEvent,
  'This Week': IconCalendar,
  Later: IconClock,
  // Fallback
  Uncategorized: IconQuestionMark,
};

const DefaultCategoryIcon: TablerIconComponent = IconNote;

/**
 * Renders a category icon by name. Uses Tabler Icons for
 * recognized categories, falls back to IconNote for unknown categories.
 */
export function CategoryIcon({
  category,
  className = 'w-5 h-5',
  style,
}: {
  category: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = CATEGORY_ICON_MAP[category];
  if (!Icon) {
    if (import.meta.env.DEV) {
      console.warn(`[CategoryIcon] Unknown category "${category}", using default icon`);
    }
    return <DefaultCategoryIcon className={className} stroke={1.5} style={style} />;
  }
  return <Icon className={className} stroke={1.5} style={style} />;
}

// =============================================================================
// List Icons (Tabler Icons - for list icon picker and display)
// =============================================================================

const LIST_ICON_MAP: Record<string, TablerIconComponent> = {
  cart: IconShoppingCart,
  backpack: IconBackpack,
  check: IconCircleCheck,
  note: IconNote,
  home: IconHome,
  gift: IconGift,
  star: IconStar,
  heart: IconHeart,
  target: IconTarget,
  pin: IconPinned,
  pencil: IconPencil,
  clipboard: IconClipboardList,
};

/** Known legacy emoji icons from EditListModal before migration */
const LEGACY_EMOJI_ICONS = new Set([
  '🛒', '🎒', '✅', '📝', '🏠', '🎁',
  '🌟', '❤️', '🎯', '📌', '✏️', '📋',
]);

/** Available icon IDs for the list icon picker in EditListModal */
export const LIST_ICON_OPTIONS = Object.keys(LIST_ICON_MAP);

/**
 * Renders a list icon by ID. Falls back to rendering legacy emoji
 * for values stored in the database before the icon migration.
 */
export function ListIcon({
  icon,
  className = 'w-5 h-5',
  style,
}: {
  icon: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const TablerIcon = LIST_ICON_MAP[icon];
  if (TablerIcon) {
    return <TablerIcon className={className} stroke={1.5} style={style} />;
  }
  // Validate it's a known legacy emoji, not garbage data
  if (LEGACY_EMOJI_ICONS.has(icon)) {
    return <span className="text-xl leading-none" style={style}>{icon}</span>;
  }
  // Unknown icon value - log and render default
  if (import.meta.env.DEV) {
    console.warn(`[ListIcon] Unknown icon value "${icon}", rendering default`);
  }
  return <IconNote className={className} stroke={1.5} style={style} />;
}
