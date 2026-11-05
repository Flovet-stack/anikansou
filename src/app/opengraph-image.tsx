import { ImageResponse } from "next/og";

export const alt = "AniKansou: thoughts after watching";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <div style={{ fontSize: 112, fontWeight: 700 }}>AniKansou</div>
      <div style={{ fontSize: 40, marginTop: 16, color: "#a3a3a3" }}>
        Thoughts after watching
      </div>
    </div>,
    size,
  );
}
