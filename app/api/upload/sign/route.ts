import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const res = NextResponse.next();
    const userId = getOrCreateSessionId(req, res);

    const body = await req.json().catch(() => ({}));
    const filename = body?.filename || `invoice_${Date.now()}.pdf`;
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/${Date.now()}_${cleanFilename}`;

    // If Supabase Storage is configured, generate signed upload URL
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data, error } = await supabaseAdmin.storage
        .from('invoices')
        .createSignedUploadUrl(storagePath);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(
        {
          signedUrl: data.signedUrl,
          token: data.token,
          storagePath,
        },
        { headers: res.headers }
      );
    }

    // Local / Dev Fallback: Return a simulated upload endpoint path
    return NextResponse.json(
      {
        signedUrl: `/api/upload/mock?path=${encodeURIComponent(storagePath)}`,
        storagePath,
        isMock: true,
      },
      { headers: res.headers }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create upload URL' }, { status: 500 });
  }
}
