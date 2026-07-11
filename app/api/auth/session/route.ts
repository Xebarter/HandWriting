import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return NextResponse.json(
        { userId: user.id, email: user.email ?? null },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        },
      );
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read session' },
      { status: 500 },
    );
  }
}
