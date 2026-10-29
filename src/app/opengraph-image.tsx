import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "CrazyBill — Snap your light bill. Find the overcharge. Send the complaint.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [black, mono] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/Geist-Black.ttf")),
    readFile(join(process.cwd(), "src/assets/GeistMono-Bold.ttf")),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FFD60A",
          padding: "64px 72px",
          color: "#111111",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 16,
              border: "5px solid #111",
              background: "#FAF7F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="#111" stroke="#111" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
          </div>
          <div style={{ fontFamily: "Geist Mono", fontSize: 26, letterSpacing: 4, textTransform: "uppercase" }}>NEPA bill checker · Nigeria</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 168, lineHeight: 0.95, letterSpacing: -6 }}>CrazyBill</div>
          <div style={{ fontSize: 50, lineHeight: 1.15, marginTop: 24, maxWidth: 1000 }}>
            Snap your light bill. Find the overcharge. Send the complaint.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "4px dashed #111",
            paddingTop: 22,
            fontFamily: "Geist Mono",
            fontSize: 24,
          }}
        >
          <span>NVIDIA Nemotron · Nebius Token Factory · Tavily</span>
          <span style={{ background: "#111", color: "#FFD60A", padding: "2px 12px" }}>Overcharge found</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: black, weight: 900, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 700, style: "normal" },
      ],
    },
  );
}
