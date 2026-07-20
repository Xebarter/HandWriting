/** True when running inside the Electron desktop build (offline, no cloud auth). */
export function isDesktopApp(): boolean {
  return process.env.NEXT_PUBLIC_DESKTOP_APP === '1';
}
