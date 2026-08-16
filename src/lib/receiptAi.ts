import "server-only";

export interface ExtractedReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number;
  category: string | null;
  subcategory: string | null;
}

export interface ExtractedReceipt {
  storeName: string | null;
  purchaseDate: string | null;
  totalAmount: number | null;
  items: ExtractedReceiptItem[];
}

export interface CategoryOption {
  name: string;
  subcategories: string[];
}

const MODEL = "claude-haiku-4-5-20251001";
const TOOL_NAME = "record_receipt";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function buildPrompt(categories: CategoryOption[]): string {
  const categoryList = categories
    .map((category) =>
      category.subcategories.length > 0
        ? `- ${category.name}: ${category.subcategories.join(", ")}`
        : `- ${category.name}`,
    )
    .join("\n");

  return `Odczytaj to zdjęcie polskiego paragonu sklepowego i zapisz jego dane wywołując narzędzie "${TOOL_NAME}".

Wypisz WSZYSTKIE kupione pozycje (pomiń linie typu "SUMA", "PTU", numer NIP, dane kasjera, numer transakcji — tylko realne zakupione produkty/usługi). Odczytaj kwoty dokładnie tak jak są wydrukowane.

Dla każdej pozycji dobierz kategorię i (jeśli pasuje) podkategorię WYŁĄCZNIE z tej listy, przepisując nazwę dokładnie tak jak w liście — jeśli żadna nie pasuje, pomiń pole:
${categoryList}`;
}

const RECEIPT_TOOL = {
  name: TOOL_NAME,
  description: "Zapisuje dane odczytane z paragonu sklepowego.",
  input_schema: {
    type: "object",
    properties: {
      store_name: { type: ["string", "null"] },
      purchase_date: { type: ["string", "null"], description: "Data zakupu w formacie YYYY-MM-DD." },
      total_amount: { type: ["number", "null"], description: "Suma do zapłaty z paragonu." },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit_price: { type: ["number", "null"] },
            total_price: { type: "number" },
            category: { type: ["string", "null"] },
            subcategory: { type: ["string", "null"] },
          },
          required: ["name", "total_price"],
        },
      },
    },
    required: ["items"],
  },
};

interface ClaudeToolUseBlock {
  type: "tool_use";
  name: string;
  input: Record<string, unknown>;
}

interface ClaudeResponse {
  content?: Array<{ type: string } & Partial<ClaudeToolUseBlock>>;
  error?: { message?: string };
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function extractReceipt(
  apiKey: string,
  imageBytes: Uint8Array,
  categories: CategoryOption[],
): Promise<ExtractedReceipt> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      tools: [RECEIPT_TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: toBase64(imageBytes) } },
            { type: "text", text: buildPrompt(categories) },
          ],
        },
      ],
    }),
  });

  const data = (await response.json()) as ClaudeResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `Claude API zwróciło błąd (${response.status}).`);
  }

  const toolUse = data.content?.find((block): block is ClaudeToolUseBlock => block.type === "tool_use");
  if (!toolUse) {
    throw new Error("Model AI nie zwrócił ustrukturyzowanej odpowiedzi.");
  }

  const parsed = toolUse.input;
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  return {
    storeName: nonEmptyString(parsed.store_name),
    purchaseDate: nonEmptyString(parsed.purchase_date),
    totalAmount: toNumber(parsed.total_amount),
    items: items.map((item): ExtractedReceiptItem => {
      const row = item as Record<string, unknown>;
      return {
        name: nonEmptyString(row.name) ?? "Pozycja",
        quantity: typeof row.quantity === "number" && row.quantity > 0 ? row.quantity : 1,
        unitPrice: toNumber(row.unit_price),
        totalPrice: toNumber(row.total_price) ?? 0,
        category: nonEmptyString(row.category),
        subcategory: nonEmptyString(row.subcategory),
      };
    }),
  };
}
