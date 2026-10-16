import { getOpeningSampleLineup } from "@/lib/opening-sample-cache";
import { connection } from "next/server";

export async function GET() {
  await connection();
  const lineup = await getOpeningSampleLineup();
  return Response.json({ lineup });
}
