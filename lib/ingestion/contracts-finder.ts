import { prisma } from "@/lib/db/client";
import { normalizeContractsFinderOcds } from "./normalize";

const BASE_URL = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search";

// Construction CPV codes to filter on
const CONSTRUCTION_CPV_CODES = [
  "45000000",
  "45100000",
  "45200000",
  "45210000",
  "45300000",
  "45400000",
  "50000000",
  "71000000",
  "71200000",
  "71300000",
  "71500000",
  "72224000",
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithBackoff(url: string, attempt = 0): Promise<Response> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 5) throw new Error(`Max retries reached for ${url}: ${res.status}`);
      const delay = Math.pow(2, attempt + 1) * 1000;
      await sleep(delay);
      return fetchWithBackoff(url, attempt + 1);
    }

    return res;
  } catch (err) {
    if (attempt >= 5) throw err;
    const delay = Math.pow(2, attempt + 1) * 1000;
    await sleep(delay);
    return fetchWithBackoff(url, attempt + 1);
  }
}

async function fetchPage(
  cpv: string,
  page: number,
  publishedFrom: string
): Promise<{ releases: unknown[]; total: number }> {
  const params = new URLSearchParams({
    cpvCodes: cpv,
    publishedFrom,
    page: String(page),
    limit: "100",
  });

  const url = `${BASE_URL}?${params}`;
  const res = await fetchWithBackoff(url);

  if (!res.ok) {
    throw new Error(`CF API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    releases: data?.releases ?? data?.data ?? [],
    total: data?.totalNotices ?? data?.total ?? 0,
  };
}

export async function runContractsFinderSync(): Promise<{
  fetched: number;
  newCount: number;
  updatedCount: number;
  error?: string;
}> {
  const startedAt = new Date();
  let totalFetched = 0;
  let totalNew = 0;
  let totalUpdated = 0;
  let syncError: string | undefined;

  const syncLogId = (
    await prisma.syncLog.create({
      data: {
        source_system: "contracts_finder",
        started_at: startedAt,
      },
    })
  ).id;

  try {
    // Incremental: only fetch notices from last sync (or last 30 days for first run)
    const source = await prisma.source.findFirst({
      where: { name: "contracts_finder" },
    });

    const lastSynced = source?.last_synced;
    const publishedFrom = lastSynced
      ? lastSynced.toISOString().split("T")[0]
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    for (const cpv of CONSTRUCTION_CPV_CODES) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        // Throttle: 1 req/sec
        await sleep(1000);

        let releases: unknown[];
        let total: number;

        try {
          ({ releases, total } = await fetchPage(cpv, page, publishedFrom));
        } catch (err) {
          syncError = String(err);
          break;
        }

        totalFetched += releases.length;

        for (const release of releases) {
          try {
            const normalized = normalizeContractsFinderOcds(release);
            if (!normalized.ocid) continue;

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
                  buyer_identifier: normalized.buyer_identifier,
                  buyer_type: normalized.buyer_type,
                  updated_at: normalized.updated_at,
                  tender_deadline: normalized.tender_deadline,
                  value_min: normalized.value_min,
                  value_max: normalized.value_max,
                  status: normalized.status,
                  documents: normalized.documents ?? undefined,
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
            // Log malformed notice and continue
            console.error("Failed to process notice:", err);
          }
        }

        hasMore = releases.length === 100 && totalFetched < total;
        page++;
      }
    }

    // Update last_synced on source
    await prisma.source.upsert({
      where: { id: source?.id ?? "" },
      update: { last_synced: new Date() },
      create: {
        name: "contracts_finder",
        base_url: BASE_URL,
        auth_type: "none",
        last_synced: new Date(),
        is_active: true,
      },
    }).catch(async () => {
      // If upsert by id fails (no id), upsert by name
      const existing = await prisma.source.findFirst({ where: { name: "contracts_finder" } });
      if (existing) {
        await prisma.source.update({ where: { id: existing.id }, data: { last_synced: new Date() } });
      } else {
        await prisma.source.create({
          data: {
            name: "contracts_finder",
            base_url: BASE_URL,
            auth_type: "none",
            last_synced: new Date(),
            is_active: true,
          },
        });
      }
    });
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

  return {
    fetched: totalFetched,
    newCount: totalNew,
    updatedCount: totalUpdated,
    error: syncError,
  };
}
