import { cn } from '@/lib/utils';

interface AppLogoProps {
  size?: number;
  className?: string;
  /** Accessible label; set false to mark as decorative. */
  alt?: string | false;
}

export function AppLogo({ size = 28, className, alt = 'HandWriting' }: AppLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/favicon.svg"
      alt={alt === false ? '' : alt}
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
      aria-hidden={alt === false ? true : undefined}
    />
  );
}
