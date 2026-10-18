import { decodeImageProxyTarget } from "@/lib/image-proxy-encode";
import { fetchAllowedImage } from "@/lib/image-proxy-fetch";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const raw = decodeImageProxyTarget(token);
  if (!raw) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const result = await fetchAllowedImage(raw);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return new NextResponse(Buffer.from(result.body), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
