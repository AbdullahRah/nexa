import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Footer,
  PageNumber,
  NumberFormat,
  PageBreak,
} from "docx";

interface DocumentMetadata {
  title: string;
  buyer: string;
  deadline: string;
}

function parseBoldText(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: "Calibri",
          size: 22,
        })
      );
    } else if (part.length > 0) {
      runs.push(
        new TextRun({
          text: part,
          font: "Calibri",
          size: 22,
        })
      );
    }
  }

  return runs;
}

function parseContentToParagraphs(content: string): Paragraph[] {
  const lines = content.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Empty line → spacing paragraph
    if (trimmed === "") {
      paragraphs.push(new Paragraph({ spacing: { after: 200 } }));
      continue;
    }

    // Heading 3
    if (trimmed.startsWith("### ")) {
      const headingText = trimmed.slice(4);
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: headingText,
              font: "Calibri",
              size: 26,
              bold: true,
            }),
          ],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    // Heading 2
    if (trimmed.startsWith("## ")) {
      const headingText = trimmed.slice(3);
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: headingText,
              font: "Calibri",
              size: 30,
              bold: true,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 320, after: 160 },
        })
      );
      continue;
    }

    // Heading 1
    if (trimmed.startsWith("# ")) {
      const headingText = trimmed.slice(2);
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: headingText,
              font: "Calibri",
              size: 36,
              bold: true,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );
      continue;
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const bulletText = trimmed.slice(2);
      paragraphs.push(
        new Paragraph({
          children: parseBoldText(bulletText),
          bullet: { level: 0 },
          spacing: { after: 80 },
        })
      );
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      const itemText = numberedMatch[2];
      paragraphs.push(
        new Paragraph({
          children: parseBoldText(itemText),
          numbering: { reference: "default-numbering", level: 0 },
          spacing: { after: 80 },
        })
      );
      continue;
    }

    // Normal paragraph
    paragraphs.push(
      new Paragraph({
        children: parseBoldText(trimmed),
        spacing: { after: 120 },
      })
    );
  }

  return paragraphs;
}

export async function generateWordDocument(
  proposalContent: string,
  metadata: DocumentMetadata
): Promise<Buffer> {
  const contentParagraphs = parseContentToParagraphs(proposalContent);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: NumberFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Calibri",
                    size: 18,
                    color: "888888",
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Title page
          new Paragraph({ spacing: { before: 4000 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: metadata.title,
                bold: true,
                font: "Calibri",
                size: 56,
                color: "1a1a1a",
              }),
            ],
            spacing: { after: 600 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Prepared for: " + metadata.buyer,
                font: "Calibri",
                size: 28,
                color: "444444",
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Deadline: " + metadata.deadline,
                font: "Calibri",
                size: 28,
                color: "444444",
              }),
            ],
            spacing: { after: 200 },
          }),

          // Page break before content
          new Paragraph({
            children: [new PageBreak()],
          }),

          // Proposal content
          ...contentParagraphs,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}
