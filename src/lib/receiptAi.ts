import "server-only";

export interface ExtractedReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number;
  category: string | null;
}

export interface ExtractedReceipt {
  storeName: string | null;
  purchaseDate: string | null;
  totalAmount: number | null;
  items: ExtractedReceiptItem[];
}

const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

function buildPrompt(categoryNames: string[]): string {
  return `Jesteś asystentem odczytującym polskie paragony sklepowe ze zdjęcia. Zwróć WYŁĄCZNIE jeden obiekt JSON (bez markdown, bez komentarzy, bez tekstu przed ani po) o dokładnie takim kształcie:
{"store_name": string|null, "purchase_date": "YYYY-MM-DD"|null, "total_amount": number|null, "items": [{"name": string, "quantity": number, "unit_price": number|null, "total_price": number, "category": string|null}]}

Dla pola "category" każdej pozycji wybierz DOKŁADNIE jedną nazwę z tej listy (przepisz ją dokładnie tak jak w liście), albo użyj null jeśli żadna nie pasuje: ${categoryNames.join(", ")}.
Kwoty podaj jako liczby z kropką jako separatorem dziesiętnym, bez symbolu waluty. Jeśli czegoś nie da się odczytać, użyj null. Jeśli na paragonie nie ma żadnych pozycji, zwróć pustą listę "items".`;
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Model AI nie zwrócił poprawnego JSON-a.");
  }
  return JSON.parse(match[0]);
}

export async function extractReceipt(ai: Ai, imageBytes: Uint8Array, categoryNames: string[]): Promise<ExtractedReceipt> {
  const result = await ai.run(MODEL, {
    prompt: buildPrompt(categoryNames),
    image: Array.from(imageBytes),
    max_tokens: 2048,
  });

  const parsed = extractJson(result.response ?? "") as Record<string, unknown>;
  if (!Array.isArray(parsed.items)) {
    throw new Error("Odpowiedź AI nie zawiera listy pozycji.");
  }

  return {
    storeName: typeof parsed.store_name === "string" ? parsed.store_name : null,
    purchaseDate: typeof parsed.purchase_date === "string" ? parsed.purchase_date : null,
    totalAmount: typeof parsed.total_amount === "number" ? parsed.total_amount : null,
    items: parsed.items.map((item): ExtractedReceiptItem => {
      const row = item as Record<string, unknown>;
      return {
        name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Pozycja",
        quantity: typeof row.quantity === "number" && row.quantity > 0 ? row.quantity : 1,
        unitPrice: typeof row.unit_price === "number" ? row.unit_price : null,
        totalPrice: typeof row.total_price === "number" ? row.total_price : 0,
        category: typeof row.category === "string" ? row.category : null,
      };
    }),
  };
}
