'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, TrendingUp, CreditCard, Facebook, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  // Data states
  const [salesData, setSalesData] = useState<any[]>([]);
  const [proshipData, setProshipData] = useState<any[]>([]);
  const [fbData, setFbData] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    // Default to this month explicitly using local padding to avoid UTC toString shifts
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');

    const lastDay = new Date(y, now.getMonth() + 1, 0);
    const lastD = String(lastDay.getDate()).padStart(2, '0');

    setDateRange({ start: `${y}-${m}-01`, end: `${y}-${m}-${lastD}` });
  }, []);

  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      fetchDashboardData();
    }
  }, [dateRange]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Get local timezone offset, e.g. +07:00 for Thailand
      const offset = new Date().getTimezoneOffset();
      const sign = offset > 0 ? '-' : '+';
      const absOffset = Math.abs(offset);
      const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
      const minutes = String(absOffset % 60).padStart(2, '0');
      const tzString = `${sign}${hours}:${minutes}`;

      const startDate = `${dateRange.start}T00:00:00${tzString}`;
      const endDate = `${dateRange.end}T23:59:59${tzString}`;

      // Convert local date strings to UNIX timestamps for the sync payload
      const d1 = new Date(startDate).getTime().toString();
      const d2 = new Date(endDate).getTime().toString();
      const payload = { from: d1, to: d2 };

      // Trigger FB Ads Sync
      await fetch('/api/sync/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(e => console.error("FB Sync error:", e));

      // Trigger Proship Sync
      await fetch('/api/sync/proship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(e => console.error("Proship Sync error:", e));

    } catch (err) {
      console.error('Error triggering sync:', err);
    } finally {
      setIsSyncing(false);
      // Fetch fresh data from Supabase after APIs run
      fetchDashboardData();
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Get local timezone offset, e.g. +07:00 for Thailand
      const offset = new Date().getTimezoneOffset();
      const sign = offset > 0 ? '-' : '+';
      const absOffset = Math.abs(offset);
      const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
      const minutes = String(absOffset % 60).padStart(2, '0');
      const tzString = `${sign}${hours}:${minutes}`;

      const startDate = `${dateRange.start}T00:00:00${tzString}`;
      const endDate = `${dateRange.end}T23:59:59${tzString}`;

      // Helper to fetch all paginated records
      const fetchAll = async (table: string, dateCol: string) => {
        let allData: any[] = [];
        let rStart = 0;
        const rCount = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data } = await supabase
            .from(table)
            .select('*')
            .gte(dateCol, startDate)
            .lte(dateCol, endDate)
            .range(rStart, rStart + rCount - 1);

          if (data && data.length > 0) {
            allData = allData.concat(data);
            rStart += rCount;
            if (data.length < rCount) hasMore = false;
          } else {
            hasMore = false;
          }
        }
        return allData;
      };

      // 1. Fetch Sales (File Sold)
      const sData = await fetchAll('sales_report', 'date_time');
      setSalesData(sData);

      // 2. Fetch Proship
      const pData = await fetchAll('proship_db', 'created_at');
      setProshipData(pData);

      // 3. Fetch FB Ads (Filtering by report_date)
      const fData = await fetchAll('facebook_ads_db', 'report_date');
      setFbData(fData || []);

      // 4. Fetch Reviews
      const { count } = await supabase
        .from('reviewed')
        .select('*', { count: 'exact', head: true })
        .gte('date_time', startDate)
        .lte('date_time', endDate);

      setReviewCount(count || 0);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Computations

  // valid sales (Don't filter out cancels to match index.html logic? FALSE: User explicitly requested to exclude spam/test/cancel orders)
  const validSales = salesData.filter(s => {
    const cxl = String(s.cxl_reason || '').toLowerCase();
    return !['spam', 'test', 'cancel', 'double', 'test_data'].includes(cxl);
  });
  const fileRevenue = validSales.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);

  // Distinct Orders logic (datetime + client)
  const distinctFileOrders = new Set(validSales.map(s => `${s.date_time}_${s.client || s.record_id}`));
  const fileOrders = distinctFileOrders.size;

  // valid proship (Filters strictly match index.html + extended system responses)
  const validProship = proshipData.filter(p => {
    // Exclude if remarks contain the explicit word 'exclude'
    if (String(p.remarks || '').toLowerCase().includes('exclude')) return false;

    const s = String(p.status || '').toUpperCase();
    return !['DRAFT', 'BLACKLISTED', 'CANCELLED', 'ERROR', 'CANCELLED_SYS', 'RETURNED', 'RETURN_TO_SENDER'].includes(s);
  });
  const proshipRevenue = validProship.reduce((acc, curr) => acc + (Number(curr.actual_sales) || 0), 0);
  const proshipCOD = validProship.reduce((acc, curr) => acc + (Number(curr.cod_amount) || 0), 0);
  const proshipOrders = validProship.length;

  const totalRevenue = fileRevenue + proshipRevenue;
  const totalOrders = fileOrders + proshipOrders;

  // Facebook
  let fbSpend = 0;
  let fbMessages = 0;
  fbData.forEach(ad => {
    fbSpend += Number(ad.spend) || 0;
    fbMessages += Number(ad.conversations_started) || 0;
  });
  const fbCpm = fbMessages > 0 ? (fbSpend / fbMessages).toFixed(2) : '0.00';

  const winRate = fbMessages > 0 ? ((totalOrders / fbMessages) * 100).toFixed(0) : '0';
  const aov = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(0) : '0';

  // Top 5 Tables Data Generation
  const fileRevMap: Record<string, number> = {};
  const fileSoldMap: Record<string, number> = {};

  validSales.forEach(s => {
    // Legacy matching: uses the raw product name string without splitting, adds raw unit/price
    const p = String(s.product || 'Unknown').trim();
    const price = Number(s.price) || 0;
    const unit = Number(s.unit) || 1;

    fileRevMap[p] = (fileRevMap[p] || 0) + price;
    fileSoldMap[p] = (fileSoldMap[p] || 0) + unit;
  });

  const proshipRevMap: Record<string, number> = {};
  const proshipSoldMap: Record<string, number> = {};

  validProship.forEach(p => {
    // Proship products stored with (qty) e.g., "SKU1)(2), SKU2)(1)"
    const skuStr = String(p.sku || '');
    const nameStr = String(p.name || '');
    const saleAmount = Number(p.actual_sales) || 0;

    const rawParts = skuStr.split(',').map(s => s.trim());
    const nameParts = nameStr.split(',').map(n => n.trim());

    // Divide revenue strictly by number of SKU items to match index.html
    const revPerItem = rawParts.length > 0 ? saleAmount / rawParts.length : 0;

    rawParts.forEach((part, idx) => {
      if (!part || part === '-') return;

      const splitIdx = part.lastIndexOf(')(');
      let displayName = part;
      let qty = 1;

      if (splitIdx !== -1) {
        displayName = part.substring(0, splitIdx).trim();
        const qtyPart = part.substring(splitIdx + 2, part.length - 1);
        qty = parseInt(qtyPart) || 1;
      }

      // Fallback display Name to Proship Name col
      if (nameParts[idx] && nameParts[idx] !== '-') {
        displayName = nameParts[idx];
      }

      proshipRevMap[displayName] = (proshipRevMap[displayName] || 0) + revPerItem;
      proshipSoldMap[displayName] = (proshipSoldMap[displayName] || 0) + qty;
    });
  });

  const getTop5 = (map: Record<string, number>) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const topFileRev = getTop5(fileRevMap);
  const topFileSold = getTop5(fileSoldMap);
  const topProshipRev = getTop5(proshipRevMap);
  const topProshipSold = getTop5(proshipSoldMap);

  return (
    <div className="space-y-6 md:space-y-10 max-w-6xl mx-auto pb-20 md:pb-0 font-medium text-sm text-brand-900 fade-in">

      {/* Header & Access Info */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-brand-800 tracking-tight">Overview</h2>
          <p className="text-brand-500 font-bold mt-1 text-xs md:text-sm">Global Sales Performance</p>
        </div>
        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-lg border border-blue-50">
          <input
            type="date"
            value={dateRange.start}
            onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
            className="p-2 border-none bg-blue-50/50 rounded-xl text-xs font-black text-blue-600 outline-none"
          />
          <span className="text-brand-500 font-black">-</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
            className="p-2 border-none bg-blue-50/50 rounded-xl text-xs font-black text-blue-600 outline-none"
          />
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-brand-200 transition-all flex items-center justify-center ${isSyncing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          >
            <RefreshCw className={clsx("w-4 h-4", isSyncing && "animate-spin")} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
        </div>
      ) : (
        <>
          {/* Facebook Ads Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
            <div className="p-6 bg-gradient-to-br from-brand-800 to-brand-600 rounded-[32px] text-white shadow-xl shadow-indigo-100 flex flex-col justify-between">
              <div>
                <p className="text-indigo-100 font-bold uppercase text-[10px] tracking-widest mb-1">Ad Spend</p>
                <h3 className="text-3xl font-black tracking-tighter">฿{fbSpend.toLocaleString()}</h3>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 text-[10px] font-bold text-indigo-100 uppercase tracking-wide flex items-center gap-2">
                <Facebook className="w-4 h-4" /> Meta Ads Manager
              </div>
            </div>

            {/* Merged: Messages & Cost */}
            <div className="p-6 bg-white rounded-[32px] border-2 border-indigo-50 shadow-xl shadow-gray-50/50 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 w-full">
                <p className="text-indigo-400 font-bold uppercase text-[10px] tracking-widest mb-1">Total Message</p>
                <h3 className="text-3xl font-black tracking-tighter text-brand-800">{fbMessages.toLocaleString()}</h3>
                <p className="text-[10px] font-black text-brand-500 mt-2">Msg Started</p>
              </div>
              <div className="hidden md:block w-px h-16 bg-gray-100"></div>
              <div className="flex-1 w-full text-right md:text-left">
                <p className="text-indigo-400 font-bold uppercase text-[10px] tracking-widest mb-1">Cost Per Msg</p>
                <h3 className="text-3xl font-black tracking-tighter text-brand-800">฿{fbCpm}</h3>
                <p className="text-[10px] font-black text-brand-500 mt-2">Average</p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-[32px] text-white shadow-xl shadow-brand-200 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <TrendingUp className="w-32 h-32" />
              </div>
              <p className="text-blue-100 font-bold uppercase text-xs tracking-widest mb-2">Total Revenue</p>
              <h3 className="text-5xl font-black tracking-tighter">฿{totalRevenue.toLocaleString()}</h3>

              {/* Breakdown */}
              <div className="mt-4 pt-4 border-t border-white/20 flex gap-6 text-sm font-bold text-blue-50">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-white/50"></span>
                  <span>File Sold: <span className="text-white text-base">฿{fileRevenue.toLocaleString()}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-brand-300"></span>
                  <span>Proship: <span className="text-white text-base">฿{proshipRevenue.toLocaleString()} </span>
                    <span className="text-xs text-brand-700 ml-1">(COD: ฿{proshipCOD.toLocaleString()})</span>
                  </span>
                </div>
              </div>

              {/* Advanced Metrics */}
              <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-blue-100 font-bold uppercase text-[10px] tracking-widest mb-1">% Win Rate</p>
                  <h3 className="text-3xl font-black text-white tracking-tight">{winRate}%</h3>
                  <p className="text-[9px] text-blue-200 mt-0.5 font-bold opacity-80">(Total Orders / Messages)</p>
                </div>
                <div className="text-right">
                  <p className="text-blue-100 font-bold uppercase text-[10px] tracking-widest mb-1">Avg. Rev/Order</p>
                  <h3 className="text-3xl font-black text-white tracking-tight">฿{Number(aov).toLocaleString()}</h3>
                  <p className="text-[9px] text-blue-200 mt-0.5 font-bold opacity-80">(Revenue / Orders)</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Total Orders */}
              <div className="col-span-2 p-6 bg-white rounded-[32px] border-2 border-gray-50 shadow-xl shadow-gray-50/50 relative overflow-hidden group flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-brand-500">
                  <CreditCard className="w-32 h-32" />
                </div>
                <div>
                  <p className="text-brand-500 font-bold uppercase text-[10px] tracking-widest mb-1 z-10 relative">Total Orders</p>
                  <h3 className="text-4xl font-black tracking-tighter text-brand-800 z-10 relative">{totalOrders.toLocaleString()}</h3>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-6 text-[10px] font-bold text-gray-400 uppercase tracking-wide relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                    <span>Files: <span className="text-brand-800 text-sm">{fileOrders.toLocaleString()}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Proship: <span className="text-brand-800 text-sm">{proshipOrders.toLocaleString()}</span></span>
                  </div>
                </div>
              </div>

              {/* Reviews */}
              <div className="col-span-2 p-6 bg-white rounded-[32px] border-2 border-gray-50 shadow-xl shadow-gray-50/50 relative overflow-hidden group flex items-center justify-between">
                <div>
                  <p className="text-brand-500 font-bold uppercase text-[10px] tracking-widest mb-1">Reviews Collected</p>
                  <h3 className="text-4xl font-black tracking-tighter text-brand-800">{reviewCount.toLocaleString()}</h3>
                </div>
                <div className="p-4 bg-brand-50 text-brand-600 rounded-2xl">
                  <ShieldCheck className="w-8 h-8" />
                </div>
              </div>
            </div>
          </div>

          {/* Top 5 Tables */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            {/* Top Revenue */}
            <div className="bg-white rounded-[32px] border-2 border-gray-50 p-8 shadow-xl shadow-gray-100/50">
              <h4 className="text-lg font-black text-brand-800 mb-6 flex items-center gap-2">
                <span className="p-2 bg-green-100 text-green-600 rounded-lg">📈</span> Top 5 File Revenue
              </h4>
              <table className="w-full text-left font-bold text-sm">
                <tbody>
                  {topFileRev.map((item, idx) => (
                    <tr key={`frev-${idx}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-2 flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-800 flex items-center justify-center text-[10px]">{idx + 1}</span>
                        <span className="truncate max-w-[200px]" title={item[0]}>{item[0]}</span>
                      </td>
                      <td className="py-3 px-2 text-right text-blue-600">฿{item[1].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                  {topFileRev.length === 0 && <tr><td className="py-8 text-center text-gray-400">No data available</td></tr>}
                </tbody>
              </table>
            </div>
            {/* Top Sold */}
            <div className="bg-white rounded-[32px] border-2 border-gray-50 p-8 shadow-xl shadow-gray-100/50">
              <h4 className="text-lg font-black text-brand-800 mb-6 flex items-center gap-2">
                <span className="p-2 bg-blue-100 text-blue-600 rounded-lg">🏆</span> Top 5 File Best Sellers
              </h4>
              <table className="w-full text-left font-bold text-sm">
                <tbody>
                  {topFileSold.map((item, idx) => (
                    <tr key={`fsold-${idx}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-2 flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-800 flex items-center justify-center text-[10px]">{idx + 1}</span>
                        <span className="truncate max-w-[200px]" title={item[0]}>{item[0]}</span>
                      </td>
                      <td className="py-3 px-2 text-right text-brand-600">{item[1].toLocaleString()} Units</td>
                    </tr>
                  ))}
                  {topFileSold.length === 0 && <tr><td className="py-8 text-center text-gray-400">No data available</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Proship Top 5 Tables */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-white rounded-[32px] border-2 border-brand-50 p-8 shadow-xl shadow-brand-100/50">
              <h4 className="text-lg font-black text-brand-800 mb-6 flex items-center gap-2">
                <span className="p-2 bg-brand-100 text-brand-600 rounded-lg">🚚</span> Top 5 Proship Revenue
              </h4>
              <table className="w-full text-left font-bold text-sm">
                <tbody>
                  {topProshipRev.map((item, idx) => (
                    <tr key={`prev-${idx}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-2 flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-800 flex items-center justify-center text-[10px]">{idx + 1}</span>
                        <span className="truncate max-w-[200px]" title={item[0]}>{item[0]}</span>
                      </td>
                      <td className="py-3 px-2 text-right text-blue-600">฿{item[1].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                  {topProshipRev.length === 0 && <tr><td className="py-8 text-center text-gray-400">No data available</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-[32px] border-2 border-brand-50 p-8 shadow-xl shadow-brand-100/50">
              <h4 className="text-lg font-black text-brand-800 mb-6 flex items-center gap-2">
                <span className="p-2 bg-brand-100 text-brand-600 rounded-lg">📦</span> Top 5 Proship Best Sellers
              </h4>
              <table className="w-full text-left font-bold text-sm">
                <tbody>
                  {topProshipSold.map((item, idx) => (
                    <tr key={`psold-${idx}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-2 flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-800 flex items-center justify-center text-[10px]">{idx + 1}</span>
                        <span className="truncate max-w-[200px]" title={item[0]}>{item[0]}</span>
                      </td>
                      <td className="py-3 px-2 text-right text-brand-600">{item[1].toLocaleString()} Units</td>
                    </tr>
                  ))}
                  {topProshipSold.length === 0 && <tr><td className="py-8 text-center text-gray-400">No data available</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
