'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function ImportPage() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [tableName, setTableName] = useState('products_sku');

    // Supabase Table maps
    const tables = [
        { value: 'users', label: 'Users' },
        { value: 'products_sku', label: 'Products SKU' },
        { value: 'sales_report', label: 'Sales Report' },
        { value: 'reviewed', label: 'Reviewed Hub' },
        { value: 'product_for_review', label: 'Products for Review' },
        { value: 'proship_db', label: 'Proship DB' },
        { value: 'proship_product', label: 'Proship Products' },
        { value: 'error_order', label: 'Error Orders' },
        { value: 'facebook_ads_db', label: 'Facebook Ads' },
    ];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError('');
        setSuccess('');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().replace(/^\uFEFF/gm, ""), // Strip BOM and whitespace
            complete: async (results) => {
                try {
                    // Map common CSV headers from the exact Google Sheet format back to the SQL formatting
                    const mappedData = results.data.map((row: any) => {
                        const newRow: any = {};

                        // Helper to safely parse numbers
                        const getNum = (val: string) => val ? Number(val.replace(/[^0-9.-]+/g, "")) : 0;

                        // Helper to safely parse dates mapping "DD/MM/YYYY HH:mm:ss" to ISO
                        const getDate = (val: string) => {
                            if (!val || val.trim() === '') return new Date().toISOString();

                            let dateStr = val.trim();
                            // If formatted as DD/MM/YYYY
                            if (dateStr.includes('/')) {
                                const [dPart, tPart] = dateStr.split(' ');
                                const [day, month, year] = dPart.split('/');
                                if (day && month && year) {
                                    // Map to YYYY-MM-DD
                                    dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                                    if (tPart) dateStr += `T${tPart}`;
                                }
                            }

                            const d = new Date(dateStr);
                            if (isNaN(d.getTime())) {
                                console.warn("Failed to parse date string, defaulting to now:", val);
                                return new Date().toISOString();
                            }
                            return d.toISOString();
                        };

                        switch (tableName) {
                            case 'users':
                                newRow.email = row['Email'] || null;
                                newRow.name = row['Name'] || null;
                                newRow.password = row['Password'] || null;
                                newRow.position = row['Position'] || null;
                                break;
                            case 'products_sku':
                                newRow.product = row['Product'] || null;
                                newRow.category = row['Category'] || null;
                                newRow.full_price = getNum(row['FullPrice']);
                                newRow.advisor_price = getNum(row['AdvisorPrice']);
                                newRow.note = row['Note'] || null;
                                newRow.status = row['Status'] || null;
                                newRow.bundle = row['Bundle'] || null;
                                newRow.bundle_item = row['BundleItem'] || null;
                                newRow.last_update = getDate(row['LastUpdate']);
                                newRow.update_by = row['UpdateBy'] || null;
                                newRow.log = row['Log'] || null;
                                break;
                            case 'sales_report':
                                // Assuming the spreadsheet DateTime can cast properly to timestamptz. If not, it needs mapping here.
                                newRow.date_time = getDate(row['DateTime']);
                                newRow.advisor = row['Advisor'] || null;
                                newRow.client = row['Client'] || null;
                                newRow.product = row['Product'] || null;
                                newRow.unit = getNum(row['Unit']) || 1;
                                newRow.platforms = row['Platforms'] || null;
                                newRow.note = row['Note'] || null;
                                newRow.price = getNum(row['Price']);
                                newRow.bundle_item = row['BundleItem'] || null;
                                newRow.status = row['status'] || row['Status'] || null;
                                newRow.cxl_reason = row['cxlReason'] || null;
                                if (row['RecordId']) newRow.record_id = row['RecordId'];
                                break;
                            case 'reviewed':
                                newRow.date_time = getDate(row['DateTime']);
                                newRow.user_name = row['User'] || null;
                                newRow.client_name = row['ClientName'] || null;
                                newRow.source_from = row['From'] || null;
                                newRow.product = row['Product'] || null;
                                newRow.storage = row['Storage'] || null;
                                if (row['RecordId']) newRow.record_id = row['RecordId'];
                                break;
                            case 'error_order':
                                newRow.date_time_record = getDate(row['DateTimeRecord']);
                                newRow.record_staff = row['RecordStaff'] || null;
                                newRow.customer = row['Customer'] || row['Cutomer'] || null;
                                newRow.platform = row['Platform'] || null;
                                newRow.order_sku = row['OrderSKU'] || null;
                                newRow.recieve_sku = row['RecieveSKU'] || null;
                                newRow.order_value = getNum(row['OrderValue']);
                                newRow.recieve_value = getNum(row['RecieveValue']);
                                newRow.return_fee = getNum(row['ReturnFee']);
                                newRow.exp_fee = getNum(row['ExpFee']);
                                newRow.scenario = row['Scenario'] || null;
                                newRow.amend_rev = getNum(row['AmendRev']);
                                break;
                            case 'proship_db':
                                newRow.id = row['Id'] || null; // Explicit text ID in proship API
                                newRow.created_at = getDate(row['CreatedAt']);
                                newRow.tracking_no = row['Tracking #'] || null;
                                newRow.status = row['Status'] || null;
                                newRow.receiver_name = row['Receiver Name'] || null;
                                newRow.phone = row['Phone'] || null;
                                newRow.remarks = row['Remarks'] || null;
                                newRow.sku = row['SKU'] || null;
                                newRow.name = row['Name'] || null;
                                newRow.cod_amount = getNum(row['COD Amount']);
                                newRow.sale_amount = getNum(row['Sale Amount']);
                                newRow.user_name = row['user'] || null;
                                newRow.actual_sales = getNum(row['actualSales']);
                                break;
                            case 'proship_product':
                                newRow.id = row['Id'] || null;
                                newRow.name = row['Name'] || null;
                                newRow.sku = row['SKU'] || null;
                                newRow.available = row['Available'] || null;
                                newRow.sale_price = getNum(row['Sale Price']);
                                newRow.created_at = getDate(row['CreatedAt']);
                                break;
                            case 'product_for_review':
                                newRow.product = row['Product'] || null;
                                newRow.note = row['Note'] || null;
                                newRow.update_by = row['UpdateBy'] || null;
                                newRow.log = row['Log'] || null;
                                break;
                            case 'facebook_ads_db':
                                newRow.campaign_name = row['Campaign Name'] || null;
                                newRow.spend = getNum(row['Spend']);
                                newRow.impressions = getNum(row['Impressions']);
                                newRow.conversations_started = getNum(row['Conversations Started']);
                                newRow.cost_per_message = getNum(row['Cost Per Message']);
                                newRow.report_date = getDate(row['Report Date']);
                                newRow.last_updated = getDate(row['Last Updated']);
                                break;
                            default:
                                // Fallback mapping - attempt 1:1 using keys. Might fail if casing is wrong.
                                Object.keys(row).forEach(k => {
                                    newRow[k.toLowerCase().replace(/[^a-z0-9]/g, '_')] = row[k];
                                });
                                break;
                        }

                        // Remove undefined/null keys to let Supabase use defaults properly
                        Object.keys(newRow).forEach(key => (newRow[key] === undefined || newRow[key] === null || newRow[key] === "") && delete newRow[key]);
                        return newRow;
                    });

                    // Make sure not to send empty rows or rows missing required schema fields
                    const cleanData = mappedData.filter(row => {
                        if (Object.keys(row).length === 0) return false;

                        // Enforce NOT NULL schema constraints based on table
                        if (tableName === 'products_sku' && !row.product) return false;
                        if (tableName === 'sales_report' && !row.date_time) return false;
                        if (tableName === 'facebook_ads_db' && !row.campaign_name) return false;

                        return true;
                    });

                    if (cleanData.length === 0) {
                        throw new Error("No valid data found to import. Check CSV headers match expectations.");
                    }

                    // Deduplicate the array by primary key to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
                    // If a table has an 'id' or 'record_id', keep only the last occurrence in the CSV iteration.
                    const uniqueDataMap = new Map();
                    const dedupedData: any[] = [];

                    cleanData.forEach(row => {
                        const pk = row.id || row.record_id;
                        if (pk) {
                            uniqueDataMap.set(pk, row);
                        } else {
                            // If no explicit primary key or it's auto-generated, just push it
                            dedupedData.push(row);
                        }
                    });

                    // Combine them back together
                    const finalPayload = [...dedupedData, ...Array.from(uniqueDataMap.values())];

                    // Batch insert or upsert into Supabase
                    let dbError = null;

                    if (tableName === 'proship_db' || tableName === 'proship_product') {
                        // These tables use explicit string IDs which may conflict on re-import
                        const { error } = await supabase
                            .from(tableName)
                            .upsert(finalPayload, { onConflict: 'id' });
                        dbError = error;
                    } else {
                        const { error } = await supabase
                            .from(tableName)
                            .insert(finalPayload);
                        dbError = error;
                    }

                    if (dbError) throw dbError;

                    setSuccess(`Successfully imported ${finalPayload.length} records into ${tableName}!`);

                } catch (err: any) {
                    console.error(err);
                    setError(err.message || 'Error importing CSV data');
                } finally {
                    setLoading(false);
                    // Reset the file input
                    e.target.value = '';
                }
            },
            error: (err) => {
                setError("Error reading CSV file: " + err.message);
                setLoading(false);
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 fade-in">
            <div>
                <h2 className="text-3xl font-black text-brand-800 tracking-tight">Admin Importer</h2>
                <p className="text-brand-500 font-bold mt-1 text-sm">Migrate Google Sheets exports (CSV) into Supabase PostgreSQL.</p>
            </div>

            <div className="bg-white rounded-3xl p-8 border-2 border-brand-100 shadow-xl space-y-8">

                {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 font-bold flex gap-3 items-center">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {success && (
                    <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-100 font-bold flex gap-3 items-center">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        <p>{success}</p>
                    </div>
                )}

                <div className="space-y-4">
                    <label className="block text-brand-700 font-black text-lg">1. Select Target Table</label>
                    <select
                        value={tableName}
                        onChange={(e) => setTableName(e.target.value)}
                        className="w-full md:w-1/2 p-4 border-2 border-brand-200 rounded-2xl font-bold text-brand-900 outline-none focus:border-brand-500 transition-colors"
                        disabled={loading}
                    >
                        {tables.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-4">
                    <label className="block text-brand-700 font-black text-lg">2. Upload CSV File</label>
                    <div className="relative border-2 border-dashed border-brand-300 bg-brand-50 rounded-3xl p-12 text-center hover:bg-brand-100 transition-colors cursor-pointer group">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={loading}
                        />

                        <div className="flex flex-col items-center justify-center pointer-events-none">
                            {loading ? (
                                <>
                                    <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4" />
                                    <p className="font-bold text-brand-700">Importing to {tableName}...</p>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-12 h-12 text-brand-400 group-hover:text-brand-600 transition-colors mb-4" />
                                    <p className="font-bold text-brand-700 md:text-lg">Click or drag CSV file here</p>
                                    <p className="text-brand-400 font-medium text-xs mt-2 uppercase tracking-widest">Supports .csv format only</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
