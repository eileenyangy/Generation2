"use client";

import { useRef, useState, useCallback } from "react";
import confetti from "canvas-confetti";

interface PhotoSlot {
  original: string | null;
  cartoon: string | null;
  loading: boolean;
}

const EMPTY_SLOT: PhotoSlot = { original: null, cartoon: null, loading: false };

export default function Home() {
  const [slots, setSlots] = useState<PhotoSlot[]>([
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
  ]);
  const [stripReady, setStripReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const fireConfetti = useCallback(() => {
    const end = Date.now() + 2500;
    const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6bff"];
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = ev.target?.result as string;
      setSlots((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, original: preview, cartoon: null } : s
        )
      );
    };
    reader.readAsDataURL(file);
  };

  const generateStrip = async () => {
    const filled = slots.filter((s) => s.original);
    if (filled.length < 3) return;

    setGenerating(true);
    setStripReady(false);

    const updated = [...slots];

    for (let i = 0; i < 3; i++) {
      updated[i] = { ...updated[i], loading: true };
      setSlots([...updated]);

      try {
        const res = await fetch("/api/cartoonify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: updated[i].original }),
        });
        const data = await res.json();
        if (data.error) console.error(`Photo ${i + 1} error:`, data.error);
        updated[i] = {
          ...updated[i],
          cartoon: data.output || null,
          loading: false,
        };
      } catch (e) {
        console.error(`Photo ${i + 1} failed:`, e);
        updated[i] = { ...updated[i], loading: false };
      }
      setSlots([...updated]);

      // Wait between requests to avoid rate limiting
      if (i < 2) await new Promise((r) => setTimeout(r, 12000));
    }

    setGenerating(false);
    const allGenerated = updated.every((s) => s.cartoon !== null);
    setStripReady(true);
    if (allGenerated) setTimeout(fireConfetti, 300);
  };

  const downloadStrip = async () => {
    if (!stripRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(stripRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#111",
    });
    const link = document.createElement("a");
    link.download = "photobooth-strip.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const allUploaded = slots.every((s) => s.original !== null);
  const allDone = slots.every((s) => s.cartoon !== null);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center py-12 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2">PHOTOBOOTH</h1>
        <p className="text-zinc-400 text-sm tracking-widest">
          UPLOAD 3 PHOTOS — GET A CARTOON STRIP
        </p>
      </div>

      {/* Upload slots */}
      {!stripReady && (
        <div className="flex gap-4 mb-8 flex-wrap justify-center">
          {slots.map((slot, i) => (
            <label
              key={i}
              className="relative cursor-pointer group"
              style={{ width: 200, height: 200 }}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, i)}
              />
              <div
                className="w-full h-full border-2 border-dashed border-zinc-600 group-hover:border-white transition-colors flex items-center justify-center overflow-hidden relative"
                style={{ background: "#111" }}
              >
                {slot.original ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slot.original}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-zinc-500">
                    <div className="text-3xl mb-1">+</div>
                    <div className="text-xs tracking-widest">PHOTO {i + 1}</div>
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Generate button */}
      {!stripReady && (
        <button
          onClick={generateStrip}
          disabled={!allUploaded || generating}
          className="px-10 py-3 bg-white text-black font-bold tracking-widest text-sm hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mb-4"
        >
          {generating ? "GENERATING..." : "MAKE MY STRIP"}
        </button>
      )}

      {/* Progress while generating */}
      {generating && (
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex gap-4">
            {slots.map((slot, i) => (
              <div key={i} className="text-xs tracking-widest text-zinc-400">
                {slot.loading ? "RENDERING..." : slot.cartoon ? "✓ DONE" : "WAITING"}
              </div>
            ))}
          </div>
          <p className="text-zinc-600 text-xs">this takes ~30 seconds</p>
        </div>
      )}

      {/* Photobooth strip */}
      {allDone && (
        <div className="flex flex-col items-center gap-6">
          <div
            ref={stripRef}
            style={{
              background: "#111",
              padding: "16px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              border: "3px solid #333",
              width: 260,
            }}
          >
            {/* Strip header */}
            <div
              style={{
                textAlign: "center",
                color: "#fff",
                fontFamily: "monospace",
                fontSize: 11,
                letterSpacing: "0.2em",
                paddingBottom: 8,
                borderBottom: "1px solid #333",
              }}
            >
              PHOTOBOOTH
            </div>

            {/* Photos */}
            {slots.map((slot, i) => (
              <div key={i} style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slot.cartoon!}
                  alt={`Cartoon ${i + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            ))}

            {/* Strip footer */}
            <div
              style={{
                textAlign: "center",
                color: "#666",
                fontFamily: "monospace",
                fontSize: 9,
                letterSpacing: "0.15em",
                paddingTop: 8,
                borderTop: "1px solid #333",
              }}
            >
              {new Date().toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              }).toUpperCase()}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={downloadStrip}
              className="px-8 py-3 bg-white text-black font-bold tracking-widest text-sm hover:bg-zinc-200 transition-colors"
            >
              DOWNLOAD STRIP
            </button>
            <button
              onClick={() => {
                setSlots([{ ...EMPTY_SLOT }, { ...EMPTY_SLOT }, { ...EMPTY_SLOT }]);
                setStripReady(false);
              }}
              className="px-8 py-3 border border-zinc-600 text-white font-bold tracking-widest text-sm hover:border-white transition-colors"
            >
              START OVER
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
