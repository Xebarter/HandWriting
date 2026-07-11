'use client';

import React, { useMemo, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDown } from 'lucide-react';
import { FONT_FAMILIES } from '@/lib/document-constants';
import { FontMetadata } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FontFamilySelectProps {
  selectedFont: string;
  installedFonts: FontMetadata[];
  onFontFamilyChange: (family: string) => void;
}

function FontMenuItem({
  label,
  family,
  selected,
  onSelect,
}: {
  label: string;
  family: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center rounded-md px-3 py-2 text-left text-sm leading-5 text-[#201f1e] transition-colors',
        'hover:bg-[#f3f2f1] focus-visible:bg-[#f3f2f1] focus-visible:outline-none',
        selected && 'bg-[#deecf9] text-[#185abd]'
      )}
      style={{ fontFamily: family }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function FontMenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
        {label}
      </p>
      <div className="flex flex-col gap-0.5 px-1">{children}</div>
    </div>
  );
}

export function FontFamilySelect({
  selectedFont,
  installedFonts,
  onFontFamilyChange,
}: FontFamilySelectProps) {
  const [open, setOpen] = useState(false);

  const displayLabel = useMemo(() => {
    const custom = installedFonts.find((font) => font.family === selectedFont);
    return custom?.name ?? selectedFont;
  }, [installedFonts, selectedFont]);

  const showOrphanOption =
    selectedFont &&
    !FONT_FAMILIES.includes(selectedFont as (typeof FONT_FAMILIES)[number]) &&
    !installedFonts.some((font) => font.family === selectedFont);

  const selectFamily = (family: string) => {
    onFontFamilyChange(family);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          'word-font-select-trigger flex h-8 min-w-[188px] max-w-[220px] items-center justify-between gap-2 rounded border border-[#e1dfdd] bg-white px-2.5 text-sm text-[#201f1e] shadow-sm',
          'hover:border-[#c8c6c4] focus-visible:border-[#185abd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#185abd]/20',
          'data-popup-open:border-[#185abd] data-popup-open:ring-2 data-popup-open:ring-[#185abd]/20'
        )}
        aria-label="Font family"
      >
        <span className="truncate" style={{ fontFamily: selectedFont }}>
          {displayLabel}
        </span>
        <ChevronDown size={15} className="shrink-0 text-[#605e5c]" aria-hidden />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          className="z-[1000]"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={12}
        >
          <Popover.Popup
            className="word-font-select-menu max-h-72 min-w-[240px] overflow-y-auto rounded-md border border-[#e1dfdd] bg-white py-1 shadow-xl outline-none"
            role="listbox"
            aria-label="Font families"
          >
            <FontMenuSection label="Built-in">
              {FONT_FAMILIES.map((family) => (
                <FontMenuItem
                  key={family}
                  label={family}
                  family={family}
                  selected={selectedFont === family}
                  onSelect={() => selectFamily(family)}
                />
              ))}
            </FontMenuSection>

            {installedFonts.length > 0 && (
              <FontMenuSection label="My Fonts">
                {installedFonts.map((font) => (
                  <FontMenuItem
                    key={font.id}
                    label={font.name}
                    family={font.family}
                    selected={selectedFont === font.family}
                    onSelect={() => selectFamily(font.family)}
                  />
                ))}
              </FontMenuSection>
            )}

            {showOrphanOption && (
              <FontMenuSection label="Current">
                <FontMenuItem
                  label={selectedFont}
                  family={selectedFont}
                  selected
                  onSelect={() => selectFamily(selectedFont)}
                />
              </FontMenuSection>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
