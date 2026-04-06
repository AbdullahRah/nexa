import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documents = await prisma.knowledgeDocument.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("List documents error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    // Fetch the document to verify ownership and get file URL
    const document = await prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (document.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Extract the storage path from the public URL
    // Public URL format: https://<project>.supabase.co/storage/v1/object/public/knowledge-docs/<path>
    const urlParts = document.file_url.split("/knowledge-docs/");
    if (urlParts.length === 2) {
      const storagePath = decodeURIComponent(urlParts[1]);
      const { error: deleteStorageError } = await supabase.storage
        .from("knowledge-docs")
        .remove([storagePath]);

      if (deleteStorageError) {
        console.error("Storage delete error:", deleteStorageError);
        // Continue with DB deletion even if storage delete fails
      }
    }

    // Delete document (cascades to chunks via Prisma schema)
    await prisma.knowledgeDocument.delete({
      where: { id: documentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
