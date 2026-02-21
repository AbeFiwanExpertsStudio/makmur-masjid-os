// ---------------------------------------------------------------
// Flow 4: Connecting the Python AI Predictor
// ---------------------------------------------------------------
// This async function calls the FastAPI /predict-crowd endpoint.
// It can be used inside a Server Component, a Server Action, or
// a client-side component (just import and await).
//
// Usage in your Admin Dashboard:
//   const prediction = await getAiCrowdPrediction("2026-03-15", 1, true);
//   // prediction.predicted_tier → 3
//   // prediction.recommendation → "Expected Tier 3 (High) crowd. …"
// ---------------------------------------------------------------

const AI_API_URL =
  process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:8000";

export interface CrowdPrediction {
  target_date: string;
  predicted_tier: number;
  tier_label: string;
  recommended_food_packs: number;
  recommendation: string;
}

export async function getAiCrowdPrediction(
  targetDate: string,
  weatherId: number,
  isWeekend: boolean
): Promise<CrowdPrediction> {
  const res = await fetch(`${AI_API_URL}/predict-crowd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target_date: targetDate,
      weather_condition_id: weatherId,
      is_weekend: isWeekend,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`AI Predictor error (${res.status}): ${detail}`);
  }

  return res.json() as Promise<CrowdPrediction>;
}
