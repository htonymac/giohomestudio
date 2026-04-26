// GET /api/generation/models — list all models from registry
// Query params: type=image|video, active=true|false, tier=budget|moderate|premium

import { NextRequest, NextResponse } from "next/server";
import { getImageModels, getVideoModels, getAllModels, getDefaultImageModel, getDefaultVideoModel } from "@/lib/generation/model-registry";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const activeOnly = searchParams.get("active") !== "false";
  const tier = searchParams.get("tier");

  let models = type === "image" ? getImageModels(activeOnly)
    : type === "video" ? getVideoModels(activeOnly)
    : getAllModels(activeOnly);

  if (tier) {
    models = models.filter(m => m.quality_tier.includes(tier));
  }

  return NextResponse.json({
    models,
    defaults: {
      image: getDefaultImageModel().id,
      video: getDefaultVideoModel().id,
    },
  });
}
