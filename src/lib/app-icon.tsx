import { ImageResponse } from "next/og";

/** The app mark: a ring of beads on celadon — the same motif as package progress. */
export function renderAppIcon(size: number) {
  const beads = 10;
  const r = size * 0.27;
  const bead = size * 0.085;
  const c = size / 2;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#2e6e60", display: "flex", position: "relative" }}>
        {Array.from({ length: beads }, (_, i) => {
          const a = (i / beads) * Math.PI * 2 - Math.PI / 2;
          const filled = i < 7;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: c + r * Math.cos(a) - bead / 2,
                top: c + r * Math.sin(a) - bead / 2,
                width: bead,
                height: bead,
                borderRadius: bead,
                background: filled ? "#ffffff" : "transparent",
                border: filled ? "none" : `${Math.max(2, size * 0.012)}px solid #cfe3dc`,
              }}
            />
          );
        })}
      </div>
    ),
    { width: size, height: size },
  );
}
