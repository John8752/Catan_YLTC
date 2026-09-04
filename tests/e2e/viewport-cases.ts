import { devices, type BrowserContextOptions } from "@playwright/test";

export interface ViewportCase {
  name: string;
  width: number;
  height: number;
  options: BrowserContextOptions;
}

export function viewportCase(width: number, height: number): ViewportCase {
  return { name: `${width}x${height}`, width, height, options: {} };
}

// Logical display sizes, not physical raster pixels:
// https://developer.apple.com/design/human-interface-guidelines/layout
// Browser-area cases come from the installed Playwright descriptors. Toolbar
// sizes vary by Safari version/state; these are emulations, not real iOS tests.
const phones = [
  { model: "iPhone 16", width: 393, height: 852 },
  { model: "iPhone 16 Pro Max", width: 440, height: 956 },
] as const;

export const primaryPhoneCases: readonly ViewportCase[] = phones.flatMap((phone) => {
  return (["portrait", "landscape"] as const).flatMap((orientation) => {
    const descriptor = orientation === "portrait" ? phone.model : `${phone.model} landscape`;
    const { defaultBrowserType: _engine, ...device } = devices[descriptor]!;
    const screen = orientation === "portrait"
      ? { width: phone.width, height: phone.height }
      : { width: phone.height, height: phone.width };
    return (["full-canvas", "browser-area"] as const).map((area) => {
      const viewport = area === "full-canvas" ? screen : device.viewport;
      return {
        name: `${phone.model} ${orientation} ${area} @primary-phone`,
        ...viewport,
        options: { ...device, screen, viewport },
      };
    });
  });
});

export const iPhone16BrowserAreaCases: readonly ViewportCase[] = primaryPhoneCases
  .filter(({ name }) => /^iPhone 16 (portrait|landscape) browser-area /.test(name))
  .map((item) => ({ ...item, name: item.name.replace(" @primary-phone", "") }));
