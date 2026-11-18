import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

// Next's public-file inventory is built at startup. Serve media created after
// startup through a handler too, preserving existing catalog image URLs.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (
    !/^product-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(
      filename,
    )
  )
    return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(
      join(process.cwd(), "public", "images", filename),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return new Response(null, { status: 404 });
    throw error;
  }
}
