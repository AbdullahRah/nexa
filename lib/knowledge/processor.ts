import { prisma } from "@/lib/db/client";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
import mammoth from "mammoth";

/**
 * Split text into ~500-word chunks with ~50-word overlap,
 * preserving paragraph boundaries where possible.
 */
function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  // Split into paragraphs first
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let currentWords: string[] = [];

  for (const paragraph of paragraphs) {
    const paragraphWords = paragraph.split(/\s+/).filter((w) => w.length > 0);

    // If adding this paragraph exceeds chunkSize, finalize current chunk
    if (
      currentWords.length > 0 &&
      currentWords.length + paragraphWords.length > chunkSize
    ) {
      chunks.push(currentWords.join(" "));
      // Keep the last `overlap` words for context continuity
      currentWords = currentWords.slice(-overlap);
    }

    currentWords.push(...paragraphWords);

    // If the current buffer itself exceeds chunkSize, split it
    while (currentWords.length > chunkSize) {
      const slice = currentWords.slice(0, chunkSize);
      chunks.push(slice.join(" "));
      currentWords = currentWords.slice(chunkSize - overlap);
    }
  }

  // Flush remaining words
  if (currentWords.length > 0) {
    chunks.push(currentWords.join(" "));
  }

  return chunks;
}

async function extractText(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf": {
      const data = await pdfParse(buffer);
      return data.text as string;
    }
    case "docx":
    case "doc": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "txt": {
      return buffer.toString("utf-8");
    }
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

export async function processDocument(documentId: string): Promise<void> {
  try {
    const document = await prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Download the file from the stored URL
    const response = await fetch(document.file_url);
    if (!response.ok) {
      throw new Error(
        `Failed to download file: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text based on file type
    const text = await extractText(buffer, document.file_name);

    if (!text || text.trim().length === 0) {
      throw new Error("No text could be extracted from the document");
    }

    // Chunk the text
    const chunks = chunkText(text);

    // Delete any existing chunks for this document (in case of reprocessing)
    await prisma.knowledgeChunk.deleteMany({
      where: { document_id: documentId },
    });

    // Create chunk records
    await prisma.knowledgeChunk.createMany({
      data: chunks.map((content, i) => ({
        document_id: documentId,
        user_id: document.user_id,
        content,
        metadata: { chunkIndex: i },
      })),
    });

    // Mark document as ready
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: "ready", updated_at: new Date() },
    });
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);

    // Mark document as error
    await prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: "error", updated_at: new Date() },
    });

    throw error;
  }
}
