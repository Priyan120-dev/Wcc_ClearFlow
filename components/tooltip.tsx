'use client';

import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Tooltip({ content, children, disabled = false, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  // If disabled is false and no content, just render children
  if (!content) return <>{children}</>;

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-xl max-w-xs text-center whitespace-normal leading-snug border border-slate-700">
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}
