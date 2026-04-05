export interface NormalizedOpportunity {
  source_system: string;
  source_notice_id: string;
  ocid: string;
  notice_type: string | null;
  title: string | null;
  description_raw: string | null;
  buyer_name: string | null;
  buyer_identifier: string | null;
  buyer_type: string | null;
  published_at: Date | null;
  updated_at: Date | null;
  tender_deadline: Date | null;
  contract_start: Date | null;
  contract_end: Date | null;
  value_min: number | null;
  value_max: number | null;
  currency: string;
  framework_flag: boolean;
  lots_flag: boolean;
  lot_count: number | null;
  location_text: string | null;
  region_code: string | null;
  postcode: string | null;
  cpv_primary: string | null;
  cpv_additional: string[];
  keywords: string[];
  documents: object | null;
  status: string;
  source_url: string | null;
  raw_payload: object;
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
function extractCpvCodes(tender: any): { primary: string | null; additional: string[] } {
  const items = tender?.items ?? [];
  const codes: string[] = [];

  for (const item of items) {
    const classifications = item?.classification ? [item.classification] : [];
    const addl = item?.additionalClassifications ?? [];
    for (const c of [...classifications, ...addl]) {
      if (c?.scheme === "CPV" && c?.id) {
        codes.push(c.id.replace(/[^0-9]/g, "").padEnd(8, "0").slice(0, 8));
      }
    }
  }

  // Also check top-level tender classification
  if (tender?.classification?.scheme === "CPV" && tender?.classification?.id) {
    codes.unshift(tender.classification.id.replace(/[^0-9]/g, "").padEnd(8, "0").slice(0, 8));
  }

  const unique = [...new Set(codes)];
  return { primary: unique[0] ?? null, additional: unique.slice(1) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDocuments(tender: any): object | null {
  const docs = tender?.documents ?? [];
  if (!docs.length) return null;
  return docs.map((d: any) => ({
    id: d.id,
    title: d.title ?? d.description ?? null,
    url: d.url ?? null,
    mime_type: d.format ?? null,
  }));
}

export function normalizeContractsFinderOcds(release: any): NormalizedOpportunity {
  const tender = release?.tender ?? {};
  const buyer = release?.buyer ?? {};
  const parties = release?.parties ?? [];

  const buyerParty = parties.find((p: any) => p?.roles?.includes("buyer")) ?? {};

  const deadline = safeDate(tender?.tenderPeriod?.endDate);
  const cpv = extractCpvCodes(tender);

  const valueMin = safeNumber(
    tender?.value?.amount ??
    tender?.minValue?.amount ??
    tender?.estimatedValue?.amount
  );
  const valueMax = safeNumber(
    tender?.value?.amount ??
    tender?.maxValue?.amount ??
    tender?.estimatedValue?.amount
  );

  const lots = tender?.lots ?? [];

  return {
    source_system: "contracts_finder",
    source_notice_id: release?.id ?? release?.ocid ?? "",
    ocid: release?.ocid ?? "",
    notice_type: tender?.procurementMethod ?? release?.tag?.[0] ?? null,
    title: tender?.title ?? null,
    description_raw: tender?.description ?? null,
    buyer_name: buyer?.name ?? buyerParty?.name ?? null,
    buyer_identifier: buyer?.identifier?.id ?? buyerParty?.identifier?.id ?? null,
    buyer_type: buyerParty?.details?.type ?? null,
    published_at: safeDate(release?.date),
    updated_at: safeDate(release?.date),
    tender_deadline: deadline,
    contract_start: safeDate(tender?.contractPeriod?.startDate),
    contract_end: safeDate(tender?.contractPeriod?.endDate),
    value_min: valueMin,
    value_max: valueMax,
    currency: tender?.value?.currency ?? "GBP",
    framework_flag: tender?.techniques?.hasFrameworkAgreement ?? false,
    lots_flag: lots.length > 1,
    lot_count: lots.length > 0 ? lots.length : null,
    location_text:
      tender?.deliveryLocations?.[0]?.description ??
      tender?.deliveryAddress?.region ??
      null,
    region_code: tender?.deliveryLocations?.[0]?.region ?? null,
    postcode: tender?.deliveryAddress?.postalCode ?? null,
    cpv_primary: cpv.primary,
    cpv_additional: cpv.additional,
    keywords: [],
    documents: extractDocuments(tender),
    status: computeStatus(deadline),
    source_url:
      release?.contracts?.[0]?.links?.self ??
      (release?.ocid
        ? `https://www.contractsfinder.service.gov.uk/Notice/${release.ocid}`
        : null),
    raw_payload: release,
  };
}
