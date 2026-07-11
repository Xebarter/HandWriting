'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  estimateRuledFont,
  measureRuledFontAsync,
  RuledFontMetrics,
} from '@/lib/font-metrics';

/**
 * Client-only accurate font metrics. Until measured, returns the SSR estimate.
 * Measurement runs in useEffect (after hydration) to avoid mismatches.
 */
export function useRuledFontMetrics(fontFamily: string, ruledHeight: number): RuledFontMetrics {
  const [measured, setMeasured] = useState<RuledFontMetrics | null>(null);

  const estimate = useMemo(
    () => estimateRuledFont(fontFamily, ruledHeight),
    [fontFamily, ruledHeight]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const metrics = await measureRuledFontAsync(fontFamily, ruledHeight);
      if (!cancelled) {
        setMeasured(metrics);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fontFamily, ruledHeight]);

  return measured ?? estimate;
}
