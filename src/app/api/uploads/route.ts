import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeName(name: string) {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
}

export async function POST(req: Request) {
  // Disable this dev-only endpoint in production. Use Cloudinary mode instead.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Local upload API is disabled in production. Use Cloudinary mode.' },
      { status: 403 }
    );
  }
  try {
    const form = await req.formData();
    const files = form.getAll('files');
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    const urls: string[] = [];

    for (const anyFile of files) {
      if (!(anyFile instanceof File)) continue;
      const file = anyFile as File;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const safeOriginal = sanitizeName((file as any).name || 'image');
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeOriginal}`;
      const filePath = path.join(uploadDir, filename);
      await fs.writeFile(filePath, buffer);
      urls.push(`/uploads/${filename}`);
    }

    return NextResponse.json({ urls });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Upload failed' }, { status: 500 });
  }
}
