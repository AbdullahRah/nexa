import { prisma } from "@/lib/db/client";

/**
 * Retrieve the most relevant knowledge chunks for a given query.
 *
 * MVP approach: fetches up to 100 chunks for the user, scores each
 * by counting how many query keywords appear in the chunk content,
 * and returns the top-K chunks sorted by relevance.
 */
export async function retrieveRelevantChunks(
  userId: string,
  query: string,
  topK: number = 5
): Promise<string[]> {
  // Fetch all chunks for this user (capped at 100)
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { user_id: userId },
    select: { content: true },
    take: 100,
  });

  if (chunks.length === 0) {
    return [];
  }

  // Tokenize query into lowercase keywords, filtering out short/common words
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can",
    "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "and",
    "but", "or", "nor", "not", "so", "yet", "both", "either",
    "neither", "each", "every", "all", "any", "few", "more",
    "most", "other", "some", "such", "no", "only", "own", "same",
    "than", "too", "very", "just", "about", "above", "below",
    "between", "up", "down", "out", "off", "over", "under",
    "again", "further", "then", "once", "it", "its", "this",
    "that", "these", "those", "i", "me", "my", "we", "our",
    "you", "your", "he", "him", "his", "she", "her", "they",
    "them", "their", "what", "which", "who", "whom", "how",
    "when", "where", "why",
  ]);

  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (keywords.length === 0) {
    // If no meaningful keywords, return the first topK chunks
    return chunks.slice(0, topK).map((c) => c.content);
  }

  // Score each chunk by keyword match count
  const scored = chunks.map((chunk) => {
    const lowerContent = chunk.content.toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      // Count occurrences of the keyword in the chunk
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi");
      const matches = lowerContent.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    return { content: chunk.content, score };
  });

  // Sort by score descending, return top K
  scored.sort((a, b) => b.score - a.score);

  return scored
    .slice(0, topK)
    .filter((s) => s.score > 0)
    .map((s) => s.content);
}
