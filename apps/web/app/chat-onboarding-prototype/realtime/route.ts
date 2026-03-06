import { NextResponse } from "next/server";
import {
  REALTIME_ONBOARDING_INSTRUCTIONS,
  REALTIME_ONBOARDING_TOOL,
} from "../prototype-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpenAiClientSecretResponse = {
  value?: string;
  client_secret?: { value?: string; expires_at?: string | number | null };
  expires_at?: string | number | null;
  error?: { message?: string };
};

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime";

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "OPENAI_API_KEY is missing. Add it to enable the realtime onboarding host.",
      },
      { status: 500 },
    );
  }

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          output_modalities: ["audio"],
          instructions: REALTIME_ONBOARDING_INSTRUCTIONS,
          tool_choice: "auto",
          audio: {
            input: {
              noise_reduction: {
                type: "near_field",
              },
              turn_detection: {
                type: "server_vad",
              },
              transcription: {
                model: "gpt-4o-mini-transcribe",
              },
            },
            output: {
              voice: "marin",
            },
          },
          tools: [REALTIME_ONBOARDING_TOOL],
        },
      }),
      cache: "no-store",
    });

    const payload = (await openAiResponse.json().catch(() => ({}))) as OpenAiClientSecretResponse;

    const clientSecret = payload.value ?? payload.client_secret?.value ?? null;

    if (!openAiResponse.ok || !clientSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: payload.error?.message ?? "OpenAI Realtime did not return a client secret.",
        },
        { status: openAiResponse.status || 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      clientSecret,
      model,
      expiresAt: payload.client_secret?.expires_at ?? payload.expires_at ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to create the realtime client secret.",
      },
      { status: 500 },
    );
  }
}
