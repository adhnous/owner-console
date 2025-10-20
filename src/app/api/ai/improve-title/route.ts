import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { title, description, category } = await req.json();
    if (!title || !description || !category) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    // If no API key, return a quick heuristic fallback to avoid external calls.
    if (!process.env.GOOGLE_API_KEY) {
      const improved = heuristicsImprove(title, description, category);
      return NextResponse.json({ improvedTitle: improved });
    }

    try {
      // Lazy-load the flow to avoid module init errors when API key is absent
      const { improveServiceTitle } = await import('@/ai/flows/improve-service-title');
      const result = await improveServiceTitle({ title, description, category });
      return NextResponse.json(result);
    } catch (e) {
      // Network/timeouts: fallback gracefully so UI doesn't error.
      const improved = heuristicsImprove(title, description, category);
      return NextResponse.json({ improvedTitle: improved });
    }
  } catch (err: any) {
    // Fallback as last resort
    try {
      const { title, description, category } = await req.json();
      const improved = heuristicsImprove(title ?? '', description ?? '', category ?? '');
      return NextResponse.json({ improvedTitle: improved });
    } catch {
      return NextResponse.json({ improvedTitle: 'Improved Service Title' });
    }
  }
}

function heuristicsImprove(title: string, description: string, category: string) {
  const t = (title || '').trim();
  const c = (category || '').trim();
  if (t.toLowerCase().includes(c.toLowerCase())) return capitalize(t);
  const joined = `${capitalize(t)} — ${c}`.trim();
  return joined || 'Professional Service';
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
