"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Opportunity {
  id: string;
  title: string | null;
  buyer_name: string | null;
  tender_deadline: string | null;
}

interface ProposalDraft {
  id: string;
  content: string;
}

function parseContentToHtml(content: string): string {
  const lines = content.split("\n");
  const htmlParts: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" | null = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Close list if we're leaving a list context
    const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
    const isNumbered = /^\d+\.\s+/.test(trimmed);

    if (inList && !isBullet && !isNumbered) {
      htmlParts.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
      listType = null;
    }

    if (trimmed === "") {
      htmlParts.push('<div class="spacer"></div>');
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      htmlParts.push(`<h3>${applyInlineFormatting(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      htmlParts.push(`<h2>${applyInlineFormatting(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      htmlParts.push(`<h1>${applyInlineFormatting(trimmed.slice(2))}</h1>`);
      continue;
    }

    // Bullet points
    if (isBullet) {
      if (!inList || listType !== "ul") {
        if (inList) htmlParts.push(listType === "ul" ? "</ul>" : "</ol>");
        htmlParts.push("<ul>");
        inList = true;
        listType = "ul";
      }
      htmlParts.push(
        `<li>${applyInlineFormatting(trimmed.slice(2))}</li>`
      );
      continue;
    }

    // Numbered list
    if (isNumbered) {
      if (!inList || listType !== "ol") {
        if (inList) htmlParts.push(listType === "ul" ? "</ul>" : "</ol>");
        htmlParts.push("<ol>");
        inList = true;
        listType = "ol";
      }
      const text = trimmed.replace(/^\d+\.\s+/, "");
      htmlParts.push(`<li>${applyInlineFormatting(text)}</li>`);
      continue;
    }

    // Normal paragraph
    htmlParts.push(`<p>${applyInlineFormatting(trimmed)}</p>`);
  }

  if (inList) {
    htmlParts.push(listType === "ul" ? "</ul>" : "</ol>");
  }

  return htmlParts.join("\n");
}

function applyInlineFormatting(text: string): string {
  // Escape HTML first
  let safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Bold
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return safe;
}

export default function PrintProposalPage() {
  const params = useParams();
  const id = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [proposal, setProposal] = useState<ProposalDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [oppRes, propRes] = await Promise.all([
          fetch(`/api/opportunities/${id}`),
          fetch(`/api/proposals?opportunityId=${id}`),
        ]);

        if (!oppRes.ok) {
          setError("Failed to load opportunity");
          return;
        }

        const oppData = await oppRes.json();
        setOpportunity(oppData);

        if (propRes.ok) {
          const propData = await propRes.json();
          if (propData.draft) {
            setProposal(propData.draft);
          }
        }
      } catch {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  useEffect(() => {
    if (!loading && proposal && !error) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, proposal, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-gray-500 text-lg">Loading proposal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-red-500 text-lg">{error}</p>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-gray-500 text-lg">No proposal draft found</p>
      </div>
    );
  }

  const deadlineFormatted = opportunity?.tender_deadline
    ? new Date(opportunity.tender_deadline).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not specified";

  const contentHtml = parseContentToHtml(proposal.content);

  return (
    <>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-page {
            padding: 0;
            margin: 0;
          }
          .title-page {
            page-break-after: always;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          h1 { page-break-after: avoid; }
          h2 { page-break-after: avoid; }
          h3 { page-break-after: avoid; }
          ul, ol { page-break-inside: avoid; }
        }

        .print-page {
          font-family: 'Calibri', 'Segoe UI', sans-serif;
          color: #1a1a1a;
          line-height: 1.6;
          background: white;
        }

        .print-page h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 32px 0 16px;
          color: #111;
        }
        .print-page h2 {
          font-size: 20px;
          font-weight: 700;
          margin: 28px 0 12px;
          color: #222;
        }
        .print-page h3 {
          font-size: 17px;
          font-weight: 700;
          margin: 24px 0 10px;
          color: #333;
        }
        .print-page p {
          margin: 0 0 10px;
          font-size: 11pt;
        }
        .print-page ul, .print-page ol {
          margin: 0 0 12px 24px;
          font-size: 11pt;
        }
        .print-page li {
          margin-bottom: 4px;
        }
        .print-page .spacer {
          height: 12px;
        }
        .print-page strong {
          font-weight: 700;
        }
      `}</style>

      <div className="print-page">
        {/* Print button - hidden during print */}
        <div className="no-print fixed top-4 right-4 z-50">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg"
          >
            Print / Save as PDF
          </button>
        </div>

        {/* Title page */}
        <div className="title-page min-h-screen flex flex-col justify-center items-center px-8">
          <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">
            {opportunity?.title || "Proposal"}
          </h1>
          <p className="text-xl text-gray-600 mb-3">
            Prepared for: {opportunity?.buyer_name || "Unknown Buyer"}
          </p>
          <p className="text-xl text-gray-600">
            Deadline: {deadlineFormatted}
          </p>
        </div>

        {/* Proposal content */}
        <div
          className="max-w-[210mm] mx-auto px-12 py-8"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </div>
    </>
  );
}
