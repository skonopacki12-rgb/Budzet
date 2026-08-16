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
  /** Raw step-1 transcription, kept for diagnosing bad reads without live-log access. */
  rawText: string;
}

export interface CategoryOption {
  name: string;
  subcategories: string[];
}

// Not @cf/meta/llama-3.2-11b-vision-instruct: its community license excludes
// users/companies domiciled in the EU, which this app's users are.
// llava-1.5-7b-hf tried first but produced near-empty/hallucinated
// transcriptions on real receipts (see git history) — trying the only other
// image-to-text model on Workers AI, though it's smaller and built for
// short image captions rather than dense document text, so this is a
// low-confidence experiment, not an expected fix.
const VISION_MODEL = "@cf/unum/uform-gen2-qwen-500m";
const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * Turns a printed amount like "44,99 zł" or "44.99" into 44.99. Amounts are
 * requested as printed text rather than numbers the model computes itself —
 * small/mid vision-language models are far more reliable at copying digit
 * sequences than at doing the comma-to-decimal conversion in the same step.
 */
function parsePrice(text: unknown): number | null {
  if (typeof text !== "string" || !text.trim()) return null;
  const cleaned = text.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Step 1: ask the vision model only to transcribe, not to reason — its one relatively reliable skill. */
export async function transcribeReceipt(ai: Ai, imageBytes: Uint8Array): Promise<string> {
  const result = await ai.run(VISION_MODEL, {
    prompt:
      "Przepisz DOKŁADNIE cały widoczny tekst z tego zdjęcia paragonu sklepowego, linijka po linijce, w tej samej kolejności co na zdjęciu. Nie pomijaj żadnej pozycji ani kwoty, nie interpretuj, nie licz — tylko przepisz to, co widzisz.",
    image: Array.from(imageBytes),
    max_tokens: 1024,
  });

  const text = result.description ?? "";
  if (!text.trim()) {
    throw new Error("Model AI nie odczytał żadnego tekstu ze zdjęcia.");
  }
  return text;
}

const STRUCTURE_SCHEMA = {
  type: "object",
  properties: {
    store_name: { type: "string" },
    purchase_date: { type: "string" },
    total_amount: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit_price: { type: "string" },
          total_price: { type: "string" },
          category: { type: "string" },
          subcategory: { type: "string" },
        },
        required: ["name", "total_price"],
      },
    },
  },
  required: ["items"],
};

function buildStructurePrompt(ocrText: string, categories: CategoryOption[]): string {
  const categoryList = categories
    .map((category) =>
      category.subcategories.length > 0
        ? `- ${category.name}: ${category.subcategories.join(", ")}`
        : `- ${category.name}`,
    )
    .join("\n");

  return `Poniżej jest tekst przepisany z polskiego paragonu sklepowego (mógł zostać odczytany niedokładnie — użyj kontekstu, żeby sensownie zinterpretować pozycje i kwoty):

"""
${ocrText}
"""

Wypisz z niego: nazwę sklepu, datę zakupu (YYYY-MM-DD), sumę do zapłaty oraz listę kupionych pozycji (pomiń linie typu "SUMA", "PTU", "opakowanie zwrotne" jeśli to nie jest osobny zakupiony produkt, numer NIP, dane kasjera itp. — tylko realne pozycje zakupu).

Kwoty ("total_amount", "unit_price", "total_price") podaj jako tekst DOKŁADNIE tak, jak są zapisane w źródle (np. "44,99"), bez przeliczania.

Dla każdej pozycji dobierz kategorię i (jeśli pasuje) podkategorię WYŁĄCZNIE z tej listy, przepisując nazwę dokładnie tak jak w liście:
${categoryList}

Jeśli czegoś nie da się ustalić, zostaw puste pole "". Jeśli nie ma żadnych pozycji, zwróć pustą listę "items".`;
}

/**
 * With response_format: json_schema, the shape actually returned at runtime
 * doesn't reliably match the ambient `{ response: string }` type — it may be
 * the parsed object directly, an object with `.response` already parsed, an
 * object with `.response` as a JSON string, or (rarely) a bare string. Handle
 * all of them rather than assume one, since this can't be exercised locally.
 */
function extractStructuredObject(result: unknown): Record<string, unknown> {
  let candidate: unknown = result;
  if (candidate && typeof candidate === "object" && "response" in candidate) {
    candidate = (candidate as { response: unknown }).response;
  }
  if (typeof candidate === "string") {
    const match = candidate.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Model AI nie zwrócił poprawnego JSON-a.");
    }
    candidate = JSON.parse(match[0]);
  }
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Model AI nie zwrócił poprawnego JSON-a.");
  }
  return candidate as Record<string, unknown>;
}

/** Step 2: a strong text-only model turns the raw transcription into structured, categorized data. */
export async function structureReceipt(
  ai: Ai,
  ocrText: string,
  categories: CategoryOption[],
): Promise<Omit<ExtractedReceipt, "rawText">> {
  const result = await ai.run(TEXT_MODEL, {
    prompt: buildStructurePrompt(ocrText, categories),
    response_format: { type: "json_schema", json_schema: STRUCTURE_SCHEMA },
    max_tokens: 2048,
  });

  const parsed = extractStructuredObject(result);
  if (!Array.isArray(parsed.items)) {
    throw new Error("Odpowiedź AI nie zawiera listy pozycji.");
  }

  return {
    storeName: nonEmptyString(parsed.store_name),
    purchaseDate: nonEmptyString(parsed.purchase_date),
    totalAmount: parsePrice(parsed.total_amount),
    items: parsed.items.map((item): ExtractedReceiptItem => {
      const row = item as Record<string, unknown>;
      return {
        name: nonEmptyString(row.name) ?? "Pozycja",
        quantity: typeof row.quantity === "number" && row.quantity > 0 ? row.quantity : 1,
        unitPrice: parsePrice(row.unit_price),
        totalPrice: parsePrice(row.total_price) ?? 0,
        category: nonEmptyString(row.category),
        subcategory: nonEmptyString(row.subcategory),
      };
    }),
  };
}
