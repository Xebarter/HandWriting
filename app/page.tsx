import { redirect } from 'next/navigation';
import { EditorInterface } from '@/components/EditorInterface';
import { isDesktopApp } from '@/lib/runtime';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (isDesktopApp()) {
    return <EditorInterface />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <EditorInterface />;
}
