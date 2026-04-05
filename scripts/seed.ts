import { runContractsFinderSync } from "../lib/ingestion/contracts-finder";

async function main() {
  console.log("Starting full Contracts Finder ingest...");
  const start = Date.now();
  const result = await runContractsFinderSync();
  const elapsed = ((Date.now() - start) / 1000).toFixed(0);
  console.log(`Done in ${elapsed}s:`, result);
  process.exit(0);
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
