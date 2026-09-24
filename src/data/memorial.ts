export type PredictionEra = "next" | "beforeTechnology";
export type PageStatus = "available" | "pending" | "featured";

export interface MemorialPage {
  id: number;
  name: string;
  image: string;
  status: PageStatus;
  city?: string;
  bio?: string;
  prediction?: string;
  visionChoice?: string;
  questionTwo?: string;
  questionThree?: string;
  questionFour?: string;
  predictionEra?: PredictionEra;
  instagram: string;
  whatsapp: string;
  agreeVotes?: number;
  disagreeVotes?: number;
}

export const MEMORIAL_LIMIT = 1000;
export const getPagePrice = (pageNumber: number): number => {
  const normalizedPage = Number.isFinite(pageNumber) ? Math.max(1, Math.floor(pageNumber)) : 1;
  const clampedPage = Math.min(normalizedPage, MEMORIAL_LIMIT);
  const groupIndex = Math.ceil(clampedPage / 100);
  return 500 + (groupIndex - 1) * 200;
};
export const ADMIN_PASSWORD = "generation-2026-admin";
export const PAGES_STORAGE_KEY = "generation-2026-memorial";
export const PAGES_UPDATED_EVENT = "generation-2026-memorial-updated";
export const BOOKINGS_STORAGE_KEY = "generation-2026-bookings";
export const BOOKINGS_UPDATED_EVENT = "generation-2026-bookings-updated";
export type BookingStatus = "new" | "contacted" | "approved" | "rejected";
export interface Booking {
  id: string;
  createdAt: string;
  status: BookingStatus;
  name: string;
  city: string;
  instagram: string;
  whatsapp: string;
  predictionEra: PredictionEra;
  prediction: string;
  image?: string;
  questionOne?: string;
  questionTwo?: string;
  visionChoice?: string;
  paymentSender?: string;
  paymentRecipient?: string;
  paymentMethod?: "vodafone" | "instapay";
  questionThree?: string;
  questionFour?: string;
  page?: number;
  price?: number;
}

export function clearLegacyLocalData(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PAGES_STORAGE_KEY);
  window.localStorage.removeItem(BOOKINGS_STORAGE_KEY);
}

export function getStoredPages(): MemorialPage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(PAGES_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as MemorialPage[];
    return Array.isArray(parsed) && parsed.every((page) => page.id && page.name && page.instagram !== undefined && page.whatsapp !== undefined) ? parsed : [];
  } catch { return []; }
}

export function savePages(pages: MemorialPage[]): void {
  window.localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(pages));
  window.dispatchEvent(new CustomEvent(PAGES_UPDATED_EVENT, { detail: pages }));
}

export function getStoredBookings(): Booking[] {
  if (typeof window === "undefined") return [];
  try { const stored = window.localStorage.getItem(BOOKINGS_STORAGE_KEY); return stored ? JSON.parse(stored) as Booking[] : []; } catch { return []; }
}

export function saveBookings(bookings: Booking[]): void {
  window.localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
  window.dispatchEvent(new CustomEvent(BOOKINGS_UPDATED_EVENT, { detail: bookings }));
}
