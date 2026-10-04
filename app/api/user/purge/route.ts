import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { db } from '@/lib/db/repo';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const res = new NextResponse();
    const userId = getOrCreateSessionId(req, res);

    // 1. Purge all database rows for this caller
    await db.purgeUserData(userId);

    // 2. Remove files in Supabase Storage if configured
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data: fileList } = await supabaseAdmin.storage
        .from('invoices')
        .list(userId);

      if (fileList && fileList.length > 0) {
        const pathsToDelete = fileList.map((f) => `${userId}/${f.name}`);
        await supabaseAdmin.storage.from('invoices').remove(pathsToDelete);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'All your data, transactions, invoices, and storage files have been permanently deleted.',
      },
      { headers: res.headers }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to purge user data' }, { status: 500 });
  }
}
