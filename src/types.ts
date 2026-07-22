// Domain types for the Bot Architect Marketplace.

export interface ArchitectProfile {
  id: string;
  name: string;
  headline: string;
  categories: string[];
  location?: string;
  rate?: string;
  bio: string;
  skills: string[];
  portfolioLinks: string[];
  telegramHandle?: string;
  published: boolean;
  createdAt: number;
}

export interface ContactRequest {
  id: string;
  senderUserId: number;
  senderName: string;
  message: string;
  contactInfo?: string;
  targetArchitectId: string;
  timestamp: number;
  forwarded: boolean;
}

export interface AdminAction {
  id: string;
  actionType: string;
  adminId: number;
  targetId: string;
  timestamp: number;
}

export const DEFAULT_CATEGORIES = [
  "E-commerce",
  "Customer Support",
  "Booking & Scheduling",
  "Marketing & Growth",
  "Finance & Payments",
  "Data & Analytics",
  "Other",
];
