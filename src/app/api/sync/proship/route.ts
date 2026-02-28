import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        let body: any = {};

        // Handle GET vs POST correctly to prevent request.json() from failing/hanging
        if (request.method === 'POST') {
            body = await request.json().catch(() => ({}));
        } else {
            const { searchParams } = new URL(request.url);
            body.from = searchParams.get('from');
            body.to = searchParams.get('to');
        }

        const token = process.env.PROSHIP_TOKEN;

        if (!token) {
            return NextResponse.json({ success: false, message: 'PROSHIP_TOKEN not configured in env' }, { status: 500 });
        }

        // 1. Calculate Date Range (Default last 24h)
        const fromDate = body.from || (Date.now() - 86400000).toString();
        const toDate = body.to || Date.now().toString();

        const url = `https://60jbdsf4zl.execute-api.ap-southeast-1.amazonaws.com/dev/v1/orders/reports?from=${fromDate}&to=${toDate}&shopId=all&status=0`;

        // 2. Fetch List from Proship
        const listRes = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!listRes.ok) {
            return NextResponse.json({ success: false, message: `Proship API Error: ${listRes.status}` }, { status: 502 });
        }

        const listJson = await listRes.json();
        const items = listJson.Items || [];

        if (items.length === 0) {
            return NextResponse.json({ success: true, message: 'No new items to sync.', from: fromDate, to: toDate });
        }

        // 3. Fetch Details for each item (Chunking to respect rate limits)
        const detailsMap: Record<string, any> = {};
        const chunkSize = 20; // Lower chunk size for Node JS fetch

        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const promises = chunk.map((item: any) =>
                fetch(`https://60jbdsf4zl.execute-api.ap-southeast-1.amazonaws.com/dev/v1/orders/${item.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                    .then(res => res.ok ? res.json() : null)
                    .catch(() => null)
            );

            const results = await Promise.all(promises);
            results.forEach(res => {
                if (res) {
                    const key = res.id || res.details?.id;
                    if (key) detailsMap[key] = res;
                }
            });

            // Brief pause between chunks
            if (i + chunkSize < items.length) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        // 4. Fetch existing DB records to check status changes
        const { data: existingData } = await supabase.from('proship_db').select('id, status');
        const idMap = new Map(existingData?.map(row => [row.id, row.status]) || []);

        const getStatusName = (s: string) => ({ "-1": "DRAFT", "-2": "BLACKLISTED", "1": "PENDING", "2": "TO_SHIP", "3": "SHIPPED", "4": "DELIVERED", "5": "CANCELLED", "6": "ERROR", "8": "RETURN_TO_SENDER" }[s.toString()] || s);

        let appended = 0;
        let updated = 0;

        // 5. Process and Upsert logic
        for (const item of items) {
            const detailedObj = detailsMap[item.id] || {};
            const combined = { ...item, ...detailedObj };
            const details = detailedObj.details || combined.details || combined;

            const customer = details.customer || {};

            const skus: string[] = [];
            const productNames: string[] = [];
            if (details.products) {
                Object.values(details.products).forEach((p: any) => {
                    skus.push(`${p.sku || "-"}(${p.qty || 1})`);
                    productNames.push(p.name || "-");
                });
            }

            const codAmt = parseFloat(details.codAmount || 0);
            const bankData = details.bank || combined.bank || detailedObj.bank || {};
            const bankAmt = parseFloat(bankData.amount || 0);

            let actualSales = 0;
            if (codAmt > 0) actualSales = codAmt;
            else if (bankAmt > 0) actualSales = bankAmt;

            let userVal = details.user || combined.user || detailedObj.user;
            let userStr = "-";
            if (userVal) {
                if (typeof userVal === 'string') userStr = userVal;
                else if (typeof userVal === 'object') userStr = userVal.name || userVal.username || userVal.email || "-";
            }
            if (!userStr || userStr === "-" || userStr === "undefined") {
                userStr = details.salesPerson?.name || "-";
            }

            const statusRaw = item.status;
            const statusName = getStatusName(statusRaw);

            const rowData = {
                id: item.id,
                created_at: item.createdAt ? new Date(item.createdAt).toISOString() : null,
                tracking_no: item.trackingNo || details.trackingNo || "-",
                status: statusName,
                receiver_name: customer.name || "-",
                phone: customer.phoneNo ? "'" + customer.phoneNo : "-", // Retaining string conversion from Sheets
                remarks: details.remarks || "-",
                sku: skus.join(", "),
                name: productNames.join(", "),
                cod_amount: codAmt,
                sale_amount: parseFloat(details.totalSalesPrice || 0),
                user_name: userStr,
                actual_sales: actualSales
            };

            const existingStatus = idMap.get(item.id);

            if (existingStatus) {
                if (existingStatus !== statusName) {
                    // Status changed, update
                    await supabase.from('proship_db').update(rowData).eq('id', item.id);
                    updated++;
                }
            } else {
                // New item
                if (![-1, -2, 5, 6].includes(parseInt(item.status))) {
                    await supabase.from('proship_db').insert(rowData);
                    appended++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Sync complete. Added: ${appended}, Updated: ${updated}`
        });

    } catch (error: any) {
        console.error('Proship Sync Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
