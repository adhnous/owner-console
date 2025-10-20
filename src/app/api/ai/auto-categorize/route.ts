import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { description } = await req.json();
    if (!description) {
      return NextResponse.json({ error: 'Missing description' }, { status: 400 });
    }
    // Fallback to heuristics when GOOGLE_API_KEY is not set or if upstream fails
    if (!process.env.GOOGLE_API_KEY) {
      const suggestions = heuristicCategories(description);
      return NextResponse.json({ categorySuggestions: suggestions });
    }

    try {
      // Lazy-load the flow only when API key is present to avoid init errors
      const { autoCategorizeService } = await import('@/ai/flows/auto-categorize-service');
      const result = await autoCategorizeService({ description });
      return NextResponse.json(result);
    } catch (e) {
      const suggestions = heuristicCategories(description);
      return NextResponse.json({ categorySuggestions: suggestions });
    }
  } catch (err: any) {
    try {
      const { description } = await req.json();
      const suggestions = heuristicCategories(description ?? '');
      return NextResponse.json({ categorySuggestions: suggestions });
    } catch {
      return NextResponse.json({ categorySuggestions: ['General Services'] });
    }
  }
}

function heuristicCategories(description: string): string[] {
  const d = description.toLowerCase();
  const buckets: Array<{ k: RegExp; c: string }> = [
    { k: /(plumb|pipe|leak|drain|faucet)/, c: 'Plumbing' },
    { k: /(clean|housekeep|maid|sanitize)/, c: 'Home Services' },
    { k: /(car|auto|mechanic|engine|tire)/, c: 'Automotive' },
    { k: /(tutor|teach|lesson|math|science|english)/, c: 'Education' },
    { k: /(electric|wiring|socket|light|circuit)/, c: 'Electrical' },
    { k: /(wood|carpenter|furniture|cabinet)/, c: 'Carpentry' },
    { k: /(garden|landscap|lawn|tree)/, c: 'Gardening' },
  ];
  const matches = buckets.filter(b => b.k.test(d)).map(b => b.c);
  if (matches.length) {
    // Deduplicate and cap list
    return Array.from(new Set(matches)).slice(0, 5);
  }
  return ['Home Services', 'General Services'];
}
