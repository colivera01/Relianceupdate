import { NextResponse } from "next/server";
import { getAddressAutocompleteSuggestions } from "@/lib/address-autocomplete";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") || "").trim();

  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await getAddressAutocompleteSuggestions(query);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[address-autocomplete] lookup failed", error);
    return NextResponse.json({ suggestions: [] });
  }
}
