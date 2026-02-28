import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));

        const accountId = process.env.FACEBOOK_AD_ACCOUNT_ID;
        const token = process.env.FACEBOOK_TOKEN;

        if (!accountId || !token) {
            return NextResponse.json({ success: false, message: 'Facebook credentials not configured in env' }, { status: 500 });
        }

        const apiVer = "v24.0";
        let since: string, until: string;

        if (body.from && body.to) {
            const d1 = new Date(parseInt(body.from));
            const d2 = new Date(parseInt(body.to));
            const fmt = (d: Date) => `${d.getFullYear()}-${("0" + (d.getMonth() + 1)).slice(-2)}-${("0" + d.getDate()).slice(-2)}`;
            since = fmt(d1);
            until = fmt(d2);
        } else {
            const now = new Date();
            since = `${now.getFullYear()}-${("0" + (now.getMonth() + 1)).slice(-2)}-01`;
            until = `${now.getFullYear()}-${("0" + (now.getMonth() + 1)).slice(-2)}-${("0" + now.getDate()).slice(-2)}`;
        }

        const timeRange = encodeURIComponent(JSON.stringify({ 'since': since, 'until': until }));
        const filtering = encodeURIComponent(JSON.stringify([{ 'field': 'impressions', 'operator': 'GREATER_THAN', 'value': 0 }]));

        // time_increment=1 returns one row per campaign per DAY
        const url = `https://graph.facebook.com/${apiVer}/act_${accountId}/insights?fields=campaign_id,campaign_name,spend,impressions,actions&level=campaign&time_increment=1&time_range=${timeRange}&filtering=${filtering}&access_token=${token}`;

        // Facebook API paginates — collect all pages
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let allData: any[] = [];
        let nextUrl: string | null = url;

        while (nextUrl) {
            const res: Response = await fetch(nextUrl);
            if (!res.ok) {
                return NextResponse.json({ success: false, message: `FB API Error: ${res.statusText}` }, { status: 502 });
            }
            const json = await res.json();
            allData = allData.concat(json.data || []);
            nextUrl = json.paging?.next || null;
        }

        const nowIso = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const upsertRows: any[] = [];
        let totalSpend = 0;
        let totalMessages = 0;

        for (const camp of allData) {
            const spend = parseFloat(camp.spend || 0);
            const impressions = parseInt(camp.impressions || 0);
            let messages = 0;

            if (camp.actions && Array.isArray(camp.actions)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                camp.actions.forEach((act: any) => {
                    if (act.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
                        act.action_type === "messaging_conversation_started_7d") {
                        messages += parseInt(act.value || 0);
                    }
                });
            }

            const cpm = messages > 0 ? (spend / messages).toFixed(2) : '0.00';
            totalSpend += spend;
            totalMessages += messages;

            // date_start is the day this row covers (returned by FB when time_increment=1)
            const reportDate = camp.date_start; // "YYYY-MM-DD"

            upsertRows.push({
                campaign_name: camp.campaign_name,
                report_date: reportDate,
                spend: spend,
                impressions: impressions,
                conversations_started: messages,
                cost_per_message: parseFloat(cpm),
                last_updated: nowIso
            });
        }

        // Upsert: if (campaign_name, report_date) already exists → update, else insert
        // This naturally handles backfilling yesterday's partial data
        if (upsertRows.length > 0) {
            // Batch in chunks of 500 to avoid payload size limits
            const chunkSize = 500;
            for (let i = 0; i < upsertRows.length; i += chunkSize) {
                const chunk = upsertRows.slice(i, i + chunkSize);
                const { error: upsertError } = await supabase
                    .from('facebook_ads_db')
                    .upsert(chunk, { onConflict: 'campaign_name,report_date' });
                if (upsertError) throw upsertError;
            }
        }

        const avgCpm = totalMessages > 0 ? (totalSpend / totalMessages).toFixed(2) : '0.00';

        return NextResponse.json({
            success: true,
            data: {
                spend: totalSpend,
                messages: totalMessages,
                cpm: avgCpm,
                rows: upsertRows.length
            }
        });

    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.error('FB Sync Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
