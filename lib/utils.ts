import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes phone numbers for WhatsApp wa.me links:
 * - Digits only
 * - Drops leading 0
 * - Prefixes 91 for 10-digit Indian numbers
 */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 10 ? digits : null;
}
