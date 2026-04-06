import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/db/client";
import { processDocument } from "@/lib/knowledge/processor";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ["pdf", "docx", "doc", "txt"];

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const fileType = formData.get("fileType") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!fileType) {
      return NextResponse.json(
        { error: "fileType is required" },
        { status: 400 }
      );
    }

    // Validate file extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const filePath = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("knowledge-docs")
      .upload(filePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("knowledge-docs").getPublicUrl(filePath);

    // Create KnowledgeDocument record
    const document = await prisma.knowledgeDocument.create({
      data: {
        user_id: user.id,
        file_name: file.name,
        file_type: fileType,
        file_url: publicUrl,
        file_size: file.size,
        status: "processing",
      },
    });

    // Process document in background
    processDocument(document.id).catch((err) =>
      console.error(`Background processing failed for ${document.id}:`, err)
    );

    return NextResponse.json({
      document: {
        id: document.id,
        file_name: document.file_name,
        status: document.status,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
