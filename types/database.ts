export type UserRole = "customer" | "admin" | "stylist";
export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
export type BookingSource = "online" | "walk_in";
export type PaymentMethod = "cash" | "card" | "gcash" | "maya";
export type PaymentStatus = "pending" | "paid" | "refunded";
export type ProficiencyLevel = "beginner" | "skilled" | "expert";
export type LoyaltyTier = "bronze" | "silver" | "gold";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Stylist {
  id: string;
  user_id: string;
  bio: string | null;
  avatar_url: string | null;
  is_available: boolean;
  years_experience: number | null;
  personality_tags: string[] | null;
  created_at: string;
  // Joined fields
  user?: User;
  specializations?: StylistSpecialization[];
  reviews?: Review[];
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  category: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  stylist_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  notes: string | null;
  source: BookingSource;
  created_at: string;
  // Joined fields
  stylist?: Stylist;
  service?: Service;
  customer?: User;
}

export interface Transaction {
  id: string;
  booking_id: string;
  amount: number;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  reference_number: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  customer_id: string;
  stylist_id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer?: User;
}

export interface PortfolioItem {
  id: string;
  stylist_id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface StylistSpecialization {
  id: string;
  stylist_id: string;
  service_id: string;
  proficiency: ProficiencyLevel;
  service?: Service;
}

export interface AIRecommendation {
  id: string;
  customer_id: string;
  face_shape: string;
  preferences: Record<string, string> | null;
  recommended_styles: Record<string, unknown>[];
  photo_url: string | null;
  created_at: string;
}

export interface CustomerLoyalty {
  id: string;
  customer_id: string;
  points_balance: number;
  total_points_earned: number;
  tier: LoyaltyTier;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  booking_id: string | null;
  points_change: number;
  reason: string;
  created_at: string;
}
