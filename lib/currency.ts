/**
 * Indian Currency & Integer Paise Formatting Utilities
 * Eliminates floating point rounding issues by handling money as integer paise.
 */

/**
 * Converts integer paise to INR string with Indian grouping format:
 * e.g., 100000 paise -> ₹1,000.00
 * e.g., 12450000 paise -> ₹1,24,500.00
 */
export function formatPaiseToINR(paise: number | bigint, options: { decimals?: boolean; symbol?: boolean } = {}): string {
  const { decimals = true, symbol = true } = options;
  const numPaise = typeof paise === 'bigint' ? Number(paise) : Math.round(paise || 0);
  const isNegative = numPaise < 0;
  const absPaise = Math.abs(numPaise);

  const rupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;

  // Indian Number System formatting:
  // Last 3 digits grouped, then groups of 2 digits
  const rupeeStr = rupees.toString();
  let formattedRupees = '';

  if (rupeeStr.length <= 3) {
    formattedRupees = rupeeStr;
  } else {
    const lastThree = rupeeStr.substring(rupeeStr.length - 3);
    const otherNumbers = rupeeStr.substring(0, rupeeStr.length - 3);
    const paired = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedRupees = `${paired},${lastThree}`;
  }

  let result = formattedRupees;
  if (decimals) {
    result += `.${remainderPaise.toString().padStart(2, '0')}`;
  }

  const sign = isNegative ? '-' : '';
  const prefix = symbol ? '₹' : '';

  return `${sign}${prefix}${result}`;
}

/**
 * Converts integer paise to float rupees (for UI display or UPI link formatting)
 */
export function paiseToRupees(paise: number): number {
  return Number((paise / 100).toFixed(2));
}

/**
 * Converts rupees float or string to integer paise safely
 */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    const cleaned = rupees.replace(/[^0-9.-]/g, '');
    const floatVal = parseFloat(cleaned);
    if (isNaN(floatVal)) return 0;
    return Math.round(floatVal * 100);
  }
  return Math.round((rupees || 0) * 100);
}

/**
 * Parses raw text/CSV amount into integer paise
 */
export function parseAmountToPaise(input: unknown): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') return Math.round(input * 100);
  const str = String(input).trim();
  const cleaned = str.replace(/[₹,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}
