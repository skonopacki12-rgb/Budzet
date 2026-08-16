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

// Not @cf/meta/llama-3.2-11b-vision-instruct: its community license excludes
// users/companies domiciled in the EU, which this app's users are.
const MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

/**
 * Turns a printed amount like "44,99 zł" or "44.99" into 44.99. The model is
 * asked to transcribe amounts as-is rather than convert them itself — small
 * vision models are much more reliable at copying digit sequences than at
 * doing the comma-to-decimal conversion inside the same response.
 */
function parsePrice(text: unknown): number | null {
  if (typeof text !== "string") return null;
  const cleaned = text.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") && !cleaned.includes(".") ? cleaned.replace(",", ".") : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function buildPrompt(categories: CategoryOption[]): string {
  const categoryList = categories
    .map((category) =>
      category.subcategories.length > 0
        ? `- ${category.name}: ${category.subcategories.join(", ")}`
        : `- ${category.name}`,
    )
    .join("\n");

  return `Jesteś asystentem odczytującym polskie paragony sklepowe ze zdjęcia. Zwróć WYŁĄCZNIE jeden obiekt JSON (bez markdown, bez komentarzy, bez tekstu przed ani po) o dokładnie takim kształcie:
{"store_name": string|null, "purchase_date": "YYYY-MM-DD"|null, "total_amount_text": string|null, "items": [{"name": string, "quantity": number, "unit_price_text": string|null, "total_price_text": string, "category": string|null, "subcategory": string|null}]}

Pola "*_text" (kwoty) przepisz DOKŁADNIE tak, jak są wydrukowane na paragonie, cyfra po cyfrze, łącznie z przecinkiem (np. "44,99") — nie licz, nie zaokrąglaj, nie zamieniaj na inny format.

Dostępne kategorie i (opcjonalnie) podkategorie — dla "category" wybierz dokładnie jedną nazwę kategorii z listy, a dla "subcategory" (jeśli pasuje) dokładnie jedną z jej podkategorii, przepisane tak jak w liście:
${categoryList}

Jeśli żadna kategoria/podkategoria nie pasuje, użyj null. Jeśli czegoś nie da się odczytać, użyj null. Jeśli na paragonie nie ma żadnych pozycji, zwróć pustą listę "items".`;
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Model AI nie zwrócił poprawnego JSON-a.");
  }
  return JSON.parse(match[0]);
}

export async function extractReceipt(
  ai: Ai,
  imageBytes: Uint8Array,
  categories: CategoryOption[],
): Promise<ExtractedReceipt> {
  const result = await ai.run(MODEL, {
    prompt: buildPrompt(categories),
    image: Array.from(imageBytes),
    max_tokens: 2048,
  });

  const parsed = extractJson(result.description ?? "") as Record<string, unknown>;
  if (!Array.isArray(parsed.items)) {
    throw new Error("Odpowiedź AI nie zawiera listy pozycji.");
  }

  return {
    storeName: typeof parsed.store_name === "string" ? parsed.store_name : null,
    purchaseDate: typeof parsed.purchase_date === "string" ? parsed.purchase_date : null,
    totalAmount: parsePrice(parsed.total_amount_text),
    items: parsed.items.map((item): ExtractedReceiptItem => {
      const row = item as Record<string, unknown>;
      return {
        name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Pozycja",
        quantity: typeof row.quantity === "number" && row.quantity > 0 ? row.quantity : 1,
        unitPrice: parsePrice(row.unit_price_text),
        totalPrice: parsePrice(row.total_price_text) ?? 0,
        category: typeof row.category === "string" ? row.category : null,
        subcategory: typeof row.subcategory === "string" ? row.subcategory : null,
      };
    }),
  };
}
