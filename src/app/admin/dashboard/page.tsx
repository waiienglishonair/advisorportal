'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import { BarChart3, Users, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function ManagerDashboard() {
    const [salesData, setSalesData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, now.getMonth() + 1, 0);
        const lastD = String(lastDay.getDate()).padStart(2, '0');

        setDateRange({ start: `${y}-${m}-01`, end: `${y}-${m}-${lastD}` });
    }, []);

    useEffect(() => {
        if (dateRange.start && dateRange.end) {
            fetchData();
        }
    }, [dateRange]);

    const [proshipData, setProshipData] = useState<any[]>([]);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const offset = new Date().getTimezoneOffset();
            const sign = offset > 0 ? '-' : '+';
            const absOffset = Math.abs(offset);
            const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
            const minutes = String(absOffset % 60).padStart(2, '0');
            const tzString = `${sign}${hours}:${minutes}`;

            const startDate = `${dateRange.start}T00:00:00${tzString}`;
            const endDate = `${dateRange.end}T23:59:59${tzString}`;

            const d1 = new Date(startDate).getTime().toString();
            const d2 = new Date(endDate).getTime().toString();
            const payload = { from: d1, to: d2 };

            await fetch('/api/sync/facebook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(e => console.error("FB Sync error:", e));

            await fetch('/api/sync/proship', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(e => console.error("Proship Sync error:", e));

        } catch (err) {
            console.error('Error triggering sync:', err);
        } finally {
            setIsSyncing(false);
            fetchData();
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Use local offset to prevent TZ shifts in DB
            const offset = new Date().getTimezoneOffset();
            const sign = offset > 0 ? '-' : '+';
            const absOffset = Math.abs(offset);
            const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
            const minutes = String(absOffset % 60).padStart(2, '0');
            const tzString = `${sign}${hours}:${minutes}`;

            const startDate = `${dateRange.start}T00:00:00${tzString}`;
            const endDate = `${dateRange.end}T23:59:59${tzString}`;

            const helperFetchAll = async (table: string, dateCol: string) => {
                let allData: any[] = [];
                let rStart = 0;
                let hasMore = true;
                while (hasMore) {
                    const { data } = await supabase.from(table).select('*').gte(dateCol, startDate).lte(dateCol, endDate).range(rStart, rStart + 999);
                    if (data && data.length > 0) { allData = allData.concat(data); rStart += 1000; if (data.length < 1000) hasMore = false; } else hasMore = false;
                }
                return allData;
            };

            const [sData, pData] = await Promise.all([
                helperFetchAll('sales_report', 'date_time'),
                helperFetchAll('proship_db', 'created_at')
            ]);

            setSalesData(sData);
            setProshipData(pData);
        } catch (error) {
            console.error('Error fetching manager dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Computations
    const validSales = salesData.filter(s => {
        const cxl = (s.cxl_reason || '').toLowerCase();
        return !['spam', 'test', 'cancel', 'double', 'test_data'].includes(cxl);
    });

    const validProship = proshipData.filter(p => {
        if (String(p.remarks || '').toLowerCase().includes('exclude')) return false;
        const s = String(p.status || '').toUpperCase();
        return !['DRAFT', 'BLACKLISTED', 'CANCELLED', 'ERROR', 'CANCELLED_SYS', 'RETURNED', 'RETURN_TO_SENDER'].includes(s);
    });

    const fileRev = validSales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const proshipRev = validProship.reduce((sum, p) => sum + (Number(p.actual_sales) || 0), 0);

    const totalRevenue = fileRev + proshipRev;
    const totalOrders = validSales.length + validProship.length;

    // Aggregate by Advisor
    const advisorStats: Record<string, { revenue: number; orders: number; cancelRevenue: number }> = {};

    salesData.forEach(sale => {
        const adv = (sale.advisor || 'Unknown').trim();
        if (!advisorStats[adv]) advisorStats[adv] = { revenue: 0, orders: 0, cancelRevenue: 0 };

        const price = Number(sale.price) || 0;
        const cxl = (sale.cxl_reason || '').toLowerCase();
        const isCanceled = ['spam', 'test', 'cancel', 'double', 'test_data'].includes(cxl);

        if (!isCanceled) {
            advisorStats[adv].revenue += price;
            advisorStats[adv].orders += 1;
        } else {
            advisorStats[adv].cancelRevenue += price;
        }
    });

    proshipData.forEach(p => {
        const adv = (p.user_name || p.user || 'Unknown').trim();
        if (!advisorStats[adv]) advisorStats[adv] = { revenue: 0, orders: 0, cancelRevenue: 0 };

        const price = Number(p.actual_sales) || 0;
        const s = String(p.status || '').toUpperCase();
        const isExcluded = String(p.remarks || '').toLowerCase().includes('exclude');
        const isCanceled = ['DRAFT', 'BLACKLISTED', 'CANCELLED', 'ERROR', 'CANCELLED_SYS', 'RETURNED', 'RETURN_TO_SENDER'].includes(s) || isExcluded;

        if (!isCanceled) {
            advisorStats[adv].revenue += price;
            advisorStats[adv].orders += 1;
        } else {
            advisorStats[adv].cancelRevenue += price;
        }
    });

    const advisorList = Object.entries(advisorStats)
        .sort((a, b) => b[1].revenue - a[1].revenue); // Sort by highest revenue

    // Chart Data Generation (Daily Revenue Grouped by Advisor)
    // To match original "Daily Revenue by Advisor" separated column chart
    const dailyData: Record<string, Record<string, number>> = {};
    const dateLabels = new Set<string>();

    validSales.forEach(sale => {
        const adv = (sale.advisor || 'Unknown').trim();
        if (!sale.date_time) return;
        const dateStr = new Date(sale.date_time).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

        dateLabels.add(dateStr);
        if (!dailyData[adv]) dailyData[adv] = {};
        if (!dailyData[adv][dateStr]) dailyData[adv][dateStr] = 0;

        dailyData[adv][dateStr] += (Number(sale.price) || 0);
    });

    validProship.forEach(p => {
        const adv = (p.user_name || p.user || 'Unknown').trim();
        if (!p.created_at) return;
        const dateStr = new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

        dateLabels.add(dateStr);
        if (!dailyData[adv]) dailyData[adv] = {};
        if (!dailyData[adv][dateStr]) dailyData[adv][dateStr] = 0;

        dailyData[adv][dateStr] += (Number(p.actual_sales) || 0);
    });

    const sortedDates = Array.from(dateLabels); // Simple extraction, real sort might need Date parse

    const series = Object.keys(dailyData).map(adv => {
        return {
            name: adv,
            data: sortedDates.map(d => dailyData[adv][d] || 0)
        };
    });

    const chartOptions: any = {
        chart: {
            type: 'bar',
            stacked: false,
            toolbar: { show: true },
            fontFamily: 'inherit',
            background: 'transparent'
        },
        colors: ['#F79F1F', '#EA2027', '#009432', '#12CBC4', '#0652DD', '#FDA7DF', '#D980FA', '#5758BB', '#B53471'],
        plotOptions: {
            bar: {
                borderRadius: 4,
                columnWidth: '60%',
            }
        },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: {
            categories: sortedDates,
            labels: { style: { colors: '#6b7280', fontSize: '12px', fontFamily: 'Inter, sans-serif' } },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            title: { text: 'Revenue (฿)' },
            labels: {
                style: { colors: '#6b7280', fontSize: '12px', fontFamily: 'Inter, sans-serif' },
                formatter: (val: number) => `฿${val.toLocaleString()}`
            }
        },
        fill: { opacity: 1 },
        legend: {
            position: 'top',
            horizontalAlign: 'left',
            fontWeight: 700,
            fontSize: '12px',
            markers: { radius: 12 }
        },
        grid: {
            borderColor: '#f3f4f6',
            strokeDashArray: 4,
            yaxis: { lines: { show: true } }
        }
    };

    return (
        <div className="p-4 md:p-10 font-bold fade-in pb-20 md:pb-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header Row */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-4xl md:text-[56px] leading-none font-black tracking-tighter uppercase text-brand-900">
                        Manager Dashboard
                    </h2>

                    <div className="flex items-center bg-white rounded-full px-2 py-1.5 shadow-sm shadow-brand-300">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                            className="bg-transparent outline-none text-sm font-black text-brand-900 px-4 py-1.5 w-36"
                        />
                        <span className="text-brand-900 font-black mx-1">-</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                            className="bg-transparent outline-none text-sm font-black text-brand-900 px-4 py-1.5 w-36"
                        />
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={`text-white p-2 rounded-full transition-colors ml-2 flex items-center justify-center ${isSyncing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {isSyncing ? (
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            )}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 text-center text-brand-900 animate-pulse font-black text-lg">Loading Analytics...</div>
                ) : (
                    <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-sm">

                        {/* Chart Section */}
                        <div className="mb-12">
                            <h3 className="text-brand-800 font-black text-2xl uppercase tracking-tight mb-8">Daily Revenue By Advisor</h3>
                            <div className="w-full h-[500px]">
                                {series.length > 0 ? (
                                    <Chart options={chartOptions} series={series} type="bar" height="100%" width="100%" />
                                ) : (
                                    <div className="h-full flex items-center justify-center text-brand-300 text-sm">No sales data for this period</div>
                                )}
                            </div>
                        </div>

                        {/* Advisor Summary Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {advisorList.map(([name, stats], idx) => (
                                <div key={name} className="bg-brand-50 rounded-2xl p-6 border border-brand-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                                    <p className="text-brand-900 font-black text-[12px] uppercase tracking-widest mb-2">{name}</p>
                                    <h4 className="text-brand-800 text-3xl font-black tracking-tighter">฿{stats.revenue.toLocaleString()}</h4>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
