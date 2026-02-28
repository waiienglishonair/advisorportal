'use client';

import dynamic from 'next/dynamic';
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function RevenueChart({ data }: { data: any[] }) {

    // Aggregate by day
    const aggregated: Record<string, number> = {};
    data.forEach(row => {
        const dStr = row.date_time.split('T')[0];
        aggregated[dStr] = (aggregated[dStr] || 0) + Number(row.price || 0);
    });

    const sortedDates = Object.keys(aggregated).sort();
    const seriesData = sortedDates.map(date => aggregated[date]);

    const options = {
        chart: {
            type: 'area',
            toolbar: { show: false },
            zoom: { enabled: false },
            fontFamily: 'Inter, sans-serif'
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 3, colors: ['#578FCA'] },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.05,
                stops: [0, 90, 100],
                colorStops: [
                    { offset: 0, color: '#578FCA', opacity: 0.4 },
                    { offset: 100, color: '#cee2f6', opacity: 0.05 }
                ]
            }
        },
        xaxis: {
            categories: sortedDates,
            labels: { style: { colors: '#9ca3af', fontWeight: 600 } },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                formatter: (value: number) => `฿${value.toLocaleString()}`,
                style: { colors: '#9ca3af', fontWeight: 600 }
            }
        },
        grid: {
            borderColor: '#f3f4f6',
            strokeDashArray: 4,
            yaxis: { lines: { show: true } }
        },
        tooltip: {
            theme: 'light',
            y: { formatter: (value: number) => `฿${value.toLocaleString()}` }
        }
    };

    const series = [{
        name: 'Revenue',
        data: seriesData
    }];

    return (
        <div className="w-full">
            {seriesData.length > 0 ? (
                //@ts-expect-error Types conflict for dynamically loaded apexcharts
                <Chart options={options} series={series} type="area" height={320} />
            ) : (
                <div className="flex flex-col items-center justify-center h-[320px] text-brand-400 font-bold bg-brand-50/50 rounded-2xl border-2 border-dashed border-brand-200">
                    <p>No revenue data found for this period.</p>
                </div>
            )}
        </div>
    );
}
