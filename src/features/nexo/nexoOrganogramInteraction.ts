export function getNexoOrganogramViewportInteraction(isFullscreen: boolean) {
  return {
    zoomOnScroll: isFullscreen,
    zoomOnPinch: isFullscreen,
    preventScrolling: isFullscreen,
    zoomActivationKeyCode: null,
  } as const;
}
