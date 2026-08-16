import "server-only";

interface CostReportResponse {
  data: { results: { amount: string }[] }[];
  has_more: boolean;
  next_page: string | null;
}

/** Sums this calendar month's Claude spend (in USD) via the Anthropic Admin API's cost_report endpoint. */
export async function getCurrentMonthCostUsd(adminApiKey: string): Promise<number> {
  const now = new Date();
  const startingAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  let totalCents = 0;
  let page: string | null = null;

  do {
    const url = new URL("https://api.anthropic.com/v1/organizations/cost_report");
    url.searchParams.set("starting_at", startingAt);
    url.searchParams.set("limit", "31");
    if (page) url.searchParams.set("page", page);

    const response = await fetch(url, {
      headers: {
        "x-api-key": adminApiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      throw new Error(`Anthropic cost_report error: ${response.status}`);
    }

    const body = (await response.json()) as CostReportResponse;
    for (const bucket of body.data) {
      for (const result of bucket.results) {
        totalCents += Number(result.amount);
      }
    }

    page = body.has_more ? body.next_page : null;
  } while (page);

  return totalCents / 100;
}
