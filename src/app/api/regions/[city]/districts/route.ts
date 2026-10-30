import { NextResponse } from "next/server";

import { districtsOf } from "@/features/regions/districts";
import { isKnownKabkota } from "@/features/regions/regions";

type RouteContext = { params: Promise<{ city: string }> };

/** Kecamatan of one kab/kota for the profile form (public reference data, cached a day). */
export async function GET(_request: Request, context: RouteContext) {
    const { city } = await context.params;
    if (!isKnownKabkota(city)) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Kabupaten/kota tidak ditemukan." } }, { status: 404 });
    return NextResponse.json({ success: true, data: districtsOf(city) }, { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
}
