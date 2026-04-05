import { prisma } from "@/lib/db/client";
import { NormalizedOpportunity } from "./normalize";

const APIFY_RUN_URL = process.env.FIND_A_TENDER_APIFY_URL;

const CONSTRUCTION_CPV_PREFIXES = ["45", "50", "71", "72224"];

function isConstructionCpv(cpv: string | null): boolean {
  if (!cpv) return false;
  return CONSTRUCTION_CPV_PREFIXES.some((prefix) => cpv.startsWith(prefix));
}

function computeStatus(deadline: Date | null): string {
  if (!deadline) return "live";
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  if (diff < 0) return "closed";
  if (diff < 5 * 24 * 60 * 60 * 1000) return "closing_soon";
  return "live";
}

function safeDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

function safeNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeFatNotice(item: any): NormalizedOpportunity | null {
  const ocid = item.id ?? item.ocid ?? item.noticeId ?? item.uri;
  if (!ocid) return null;

  const deadline = safeDate(item.deadline ?? item.closingDate ?? item.tenderDeadline);
  const cpv = item.cpvCode ?? item.cpv ?? item.cpvCodes?.[0] ?? null;
  const cpvClean = cpv?.replace(/[^0-9]/g, "")?.padEnd(8, "0")?.slice(0, 8) ?? null;

  if (!isConstructionCpv(cpvClean)) return null;

  return {
    source_system: "find_a_tender",
    source_notice_id: String(ocid),
    ocid: `fat-${ocid}`,
    notice_type: item.noticeType ?? item.type ?? null,
    title: item.title ?? item.name ?? null,
    description_raw: item.description ?? item.summary ?? null,
    buyer_name: item.organisationName ?? item.buyer ?? item.authority ?? null,
    buyer_identifier: null,
    buyer_type: item.organisationType ?? null,
    published_at: safeDate(item.publishedDate ?? item.publishDate),
    updated_at: safeDate(item.lastUpdated ?? item.publishedDate),
    tender_deadline: deadline,
    contract_start: safeDate(item.contractStart),
    contract_end: safeDate(item.contractEnd),
    value_min: safeNumber(item.valueLow ?? item.valueFrom),
    value_max: safeNumber(item.valueHigh ?? item.valueTo ?? item.estimatedValue),
    currency: "GBP",
    framework_flag: item.isFramework ?? false,
    lots_flag: (item.lots?.length ?? 0) > 1,
    lot_count: item.lots?.length ?? null,
    location_text: item.region ?? item.location ?? item.placeOfPerformance ?? null,
    region_code: null,
    postcode: item.postcode ?? null,
    cpv_primary: cpvClean,
    cpv_additional: [],
    keywords: [],
    documents: item.documents ?? null,
    status: computeStatus(deadline),
    source_url: item.url ?? item.link ?? (item.noticeId ? `https://www.find-tender.service.gov.uk/Notice/${item.noticeId}` : null),
    raw_payload: item,
  };
}

export async function runFindATenderSync(): Promise<{
  fetched: number;
  newCount: number;
  updatedCount: number;
  skipped: number;
  error?: string;
}> {
  if (!APIFY_RUN_URL) {
    return { fetched: 0, newCount: 0, updatedCount: 0, skipped: 0, error: "No FIND_A_TENDER_APIFY_URL configured" };
  }

  const startedAt = new Date();
  let totalFetched = 0;
  let totalNew = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let syncError: string | undefined;

  const syncLogId = (
    await prisma.syncLog.create({
      data: { source_system: "find_a_tender", started_at: startedAt },
    })
  ).id;

  try {
    // Fetch the Apify dataset
    const res = await fetch(APIFY_RUN_URL, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Apify API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    // Apify can return the run info or the dataset items directly
    let items: any[] = [];

    if (Array.isArray(data)) {
      items = data;
    } else if (data?.items) {
      items = data.items;
    } else if (data?.defaultDatasetId) {
      // Fetch the actual dataset
      const dsUrl = `https://api.apify.com/v2/datasets/${data.defaultDatasetId}/items?token=${new URL(APIFY_RUN_URL).searchParams.get("token")}`;
      const dsRes = await fetch(dsUrl);
      items = await dsRes.json();
    }

    totalFetched = items.length;
    console.log(`Find a Tender: ${items.length} items from Apify`);

    for (const item of items) {
      try {
        const normalized = normalizeFatNotice(item);
        if (!normalized) {
          totalSkipped++;
          continue;
        }

        const existing = await prisma.opportunity.findUnique({
          where: { ocid: normalized.ocid },
          select: { id: true },
        });

        if (existing) {
          await prisma.opportunity.update({
            where: { ocid: normalized.ocid },
            data: {
              title: normalized.title,
              description_raw: normalized.description_raw,
              buyer_name: normalized.buyer_name,
              updated_at: normalized.updated_at,
              tender_deadline: normalized.tender_deadline,
              value_min: normalized.value_min,
              value_max: normalized.value_max,
              status: normalized.status,
              raw_payload: normalized.raw_payload,
            },
          });
          totalUpdated++;
        } else {
          await prisma.opportunity.create({
            data: {
              source_system: normalized.source_system,
              source_notice_id: normalized.source_notice_id,
              ocid: normalized.ocid,
              notice_type: normalized.notice_type,
              title: normalized.title,
              description_raw: normalized.description_raw,
              buyer_name: normalized.buyer_name,
              buyer_identifier: normalized.buyer_identifier,
              buyer_type: normalized.buyer_type,
              published_at: normalized.published_at,
              updated_at: normalized.updated_at,
              tender_deadline: normalized.tender_deadline,
              contract_start: normalized.contract_start,
              contract_end: normalized.contract_end,
              value_min: normalized.value_min,
              value_max: normalized.value_max,
              currency: normalized.currency,
              framework_flag: normalized.framework_flag,
              lots_flag: normalized.lots_flag,
              lot_count: normalized.lot_count,
              location_text: normalized.location_text,
              region_code: normalized.region_code,
              postcode: normalized.postcode,
              cpv_primary: normalized.cpv_primary,
              cpv_additional: normalized.cpv_additional,
              keywords: normalized.keywords,
              documents: normalized.documents ?? undefined,
              status: normalized.status,
              source_url: normalized.source_url,
              raw_payload: normalized.raw_payload,
            },
          });
          totalNew++;
        }
      } catch (err) {
        console.error("Failed to process FaT notice:", err);
      }
    }

    // Update source
    const source = await prisma.source.findFirst({ where: { name: "find_a_tender" } });
    if (source) {
      await prisma.source.update({ where: { id: source.id }, data: { last_synced: new Date() } });
    } else {
      await prisma.source.create({
        data: {
          name: "find_a_tender",
          base_url: "https://www.find-tender.service.gov.uk",
          auth_type: "apify",
          last_synced: new Date(),
          is_active: true,
        },
      });
    }
  } catch (err) {
    syncError = String(err);
  }

  await prisma.syncLog.update({
    where: { id: syncLogId },
    data: {
      completed_at: new Date(),
      notices_fetched: totalFetched,
      notices_new: totalNew,
      notices_updated: totalUpdated,
      error: syncError,
    },
  });

  return { fetched: totalFetched, newCount: totalNew, updatedCount: totalUpdated, skipped: totalSkipped, error: syncError };
}
