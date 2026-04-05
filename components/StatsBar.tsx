import { prisma } from "@/lib/db/client";

async function getStats() {
  try {
    const [totalNotices, valueAgg, sources] = await Promise.all([
      prisma.opportunity.count({ where: { status: { in: ["live", "closing_soon"] } } }),
      prisma.opportunity.aggregate({
        _sum: { value_max: true },
        where: { value_max: { not: null } },
      }),
      prisma.source.count({ where: { is_active: true } }),
    ]);

    return {
      totalNotices,
      totalValue: valueAgg._sum.value_max ? Number(valueAgg._sum.value_max) : 0,
      sourcesConnected: sources,
    };
  } catch {
    return { totalNotices: 0, totalValue: 0, sourcesConnected: 1 };
  }
}

function formatLargeValue(v: number): string {
  if (v >= 1_000_000_000) return `£${(v / 1_000_000_000).toFixed(1)}bn`;
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(0)}m`;
  if (v >= 1_000) return `£${(v / 1_000).toFixed(0)}k`;
  return `£${v.toLocaleString("en-GB")}`;
}

export default async function StatsBar() {
  const stats = await getStats();

  const items = [
    { value: stats.totalNotices.toLocaleString("en-GB"), label: "Live notices indexed" },
    { value: formatLargeValue(stats.totalValue), label: "Total contract value tracked" },
    { value: String(stats.sourcesConnected || 1), label: "Procurement sources connected" },
  ];

  return (
    <div className="border-t border-b border-white/[0.07] py-8">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-3 gap-8">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-3xl font-semibold font-mono text-[#F5F5F5]">{item.value}</p>
            <p className="text-xs text-[#A0A0A0] mt-1">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
