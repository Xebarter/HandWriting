'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface RibbonGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const RibbonGroup: React.FC<RibbonGroupProps> = ({ label, children, className }) => (
  <div
    className={cn(
      'ribbon-group flex shrink-0 flex-col justify-end border-r border-[#e1dfdd] px-2.5 pb-1 pt-1.5',
      className
    )}
  >
    <div className="flex h-9 items-center gap-1">{children}</div>
    <span className="ribbon-group-label mt-0.5 text-center text-[10px] font-medium leading-none text-[#605e5c]">
      {label}
    </span>
  </div>
);
