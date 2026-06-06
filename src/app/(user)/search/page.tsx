import { redirect } from "next/navigation";

type SearchPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

function normalizeQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

export default async function SearchResultsPage({ searchParams }: SearchPageProps) {
  const resolved = await searchParams;
  const query = normalizeQuery(resolved?.q);
  redirect(query ? `/browse?q=${encodeURIComponent(query)}` : "/browse");
}