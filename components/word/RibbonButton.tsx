'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface RibbonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
  label?: string;
  accent?: 'default' | 'success' | 'danger';
  compact?: boolean;
}

export const RibbonButton: React.FC<RibbonButtonProps> = ({
  active,
  icon,
  label,
  accent = 'default',
  compact,
  className,
  children,
  ...props
}) => (
  <button
    type="button"
    className={cn(
      'ribbon-btn inline-flex items-center justify-center rounded-sm transition-colors duration-100',
      compact ? 'h-7 gap-1 px-1.5' : 'h-8 gap-1.5 px-2',
      active
        ? 'bg-[#deecf9] text-[#185abd] shadow-[inset_0_0_0_1px_rgba(24,90,189,0.3)]'
        : accent === 'success'
          ? 'text-[#107c10] hover:bg-[#dff6dd]'
          : accent === 'danger'
            ? 'text-[#a4262c] hover:bg-[#fde7e9]'
            : 'text-[#323130] hover:bg-[#f3f2f1]',
      'disabled:opacity-40 disabled:pointer-events-none',
      className
    )}
    {...props}
  >
    {icon && <span className="shrink-0">{icon}</span>}
    {(label || children) && (
      <span className={cn('whitespace-nowrap leading-none', compact ? 'text-[10px]' : 'text-[11px]')}>
        {label ?? children}
      </span>
    )}
  </button>
);

/** Visual divider between control clusters within a ribbon group */
export const RibbonDivider: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('mx-0.5 h-6 w-px shrink-0 bg-[#e1dfdd]', className)} />
);
