import Replicate from "replicate";
import { NextResponse } from "next/server";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { imageUrl, prompt } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Convert base64 data URL to a Blob the SDK can upload automatically
    const base64Data = imageUrl.split(",")[1];
    const mimeType = imageUrl.split(";")[0].split(":")[1] || "image/jpeg";
    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer], { type: mimeType });

    const runWithRetry = async (retries = 4): Promise<any> => {
      try {
        return await replicate.run("black-forest-labs/flux-kontext-pro", {
          input: {
            prompt:
              prompt ||
              "Convert this photo into a fun 90s cartoon illustration. Keep the same people, poses, and composition. Vibrant colors, thick outlines, expressive cartoon faces, high quality.",
            input_image: blob,
            aspect_ratio: "match_input_image",
            output_format: "jpg",
            safety_tolerance: 2,
          },
        });
      } catch (err: any) {
        const is429 = err?.message?.includes("429") || err?.status === 429;
        if (is429 && retries > 0) {
          const match = err?.message?.match(/resets in ~(\d+)s/);
          const wait = match ? parseInt(match[1]) * 1000 + 2000 : 15000;
          console.log(`Rate limited, retrying in ${wait / 1000}s...`);
          await new Promise((r) => setTimeout(r, wait));
          return runWithRetry(retries - 1);
        }
        throw err;
      }
    };

    const output = await runWithRetry();

    // output is a FileOutput object — extract the URL string
    const outputUrl = typeof output === "string" ? output : (output as any)?.url?.()?.href ?? String(output);

    return NextResponse.json({ output: outputUrl });
  } catch (error: any) {
    console.error("Replicate error full:", JSON.stringify(error, null, 2));
    console.error("Replicate error message:", error?.message);
    console.error("Replicate error status:", error?.status);
    console.error("Replicate error detail:", error?.detail);
    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 }
    );
  }
}
