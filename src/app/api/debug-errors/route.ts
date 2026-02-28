import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data, error } = await supabase.from('error_order').select('*').limit(3);
    return NextResponse.json({ data, error });
}
