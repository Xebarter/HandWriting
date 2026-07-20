import { type NextRequest, NextResponse } from 'next/server';
import { isDesktopApp } from '@/lib/runtime';
import { updateSession } from '@/lib/supabase/proxy';

export async function middleware(request: NextRequest) {
  if (isDesktopApp()) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
