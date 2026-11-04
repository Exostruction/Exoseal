import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "ExoSeal", short_name: "ExoSeal", description: "Share secrets once, end-to-end encrypted.", start_url: "/", display: "browser", background_color: "#ffffff", theme_color: "#e11d48", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }, { src: "/apple-icon.png", sizes: "180x180", type: "image/png" }] };
}
