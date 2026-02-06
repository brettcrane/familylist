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
import type { ListType } from '../../types/api';

type HeroIconComponent = ComponentType<SVGProps<SVGSVGElement>>;
type TablerIconComponent = ComponentType<{
  className?: string;
  size?: number | string;
  stroke?: number;
  style?: React.CSSProperties;
}>;

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
  return <Icon className={className} style={style} />;
}

export function getListTypeIconComponent(type: ListType): HeroIconComponent {
  return LIST_TYPE_ICON_MAP[type];
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

export function CategoryIcon({
  category,
  className = 'w-5 h-5',
  style,
}: {
  category: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = CATEGORY_ICON_MAP[category] || DefaultCategoryIcon;
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

export const LIST_ICON_OPTIONS = Object.keys(LIST_ICON_MAP);

/**
 * Renders a list icon by ID. Falls back to rendering raw string
 * for legacy emoji values stored in the database.
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
  // Fallback: render raw string (handles legacy emoji values)
  return <span className="text-xl leading-none" style={style}>{icon}</span>;
}
