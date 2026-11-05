export function getNexoFactionTheme(color: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : "#173d5b";
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(normalized.slice(index, index + 2), 16),
  );
  const darker = `#${channels
    .map((channel) =>
      Math.round(channel * 0.68)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
  const relativeLuminance = (rgb: number[]) => {
    const [red, green, blue] = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  };
  const contrast = (first: number, second: number) =>
    (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  const backgroundLuminance = relativeLuminance(channels);
  const darkForegroundLuminance = relativeLuminance([16, 43, 61]);
  const darkText =
    contrast(backgroundLuminance, darkForegroundLuminance) >= contrast(backgroundLuminance, 1);

  return {
    accent: normalized,
    background: `linear-gradient(125deg, ${normalized} 0%, ${darker} 100%)`,
    foreground: darkText ? "#102b3d" : "#ffffff",
    muted: darkText ? "rgba(16,43,61,.72)" : "rgba(255,255,255,.76)",
    surface: darkText ? "rgba(16,43,61,.1)" : "rgba(255,255,255,.14)",
    border: darkText ? "rgba(16,43,61,.2)" : "rgba(255,255,255,.28)",
  };
}
