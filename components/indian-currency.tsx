import React from 'react';
import { formatPaiseToINR } from '@/lib/currency';

interface IndianCurrencyProps {
  paise: number | bigint;
  decimals?: boolean;
  className?: string;
  symbol?: boolean;
}

export function IndianCurrency({
  paise,
  decimals = true,
  className = '',
  symbol = true,
}: IndianCurrencyProps) {
  const formatted = formatPaiseToINR(paise, { decimals, symbol });
  return <span className={`tabular-nums font-mono font-medium ${className}`}>{formatted}</span>;
}
