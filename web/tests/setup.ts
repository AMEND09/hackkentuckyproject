import "@testing-library/jest-dom/vitest";

// maplibre-gl calls URL.createObjectURL at import time; jsdom lacks it.
if (typeof window !== "undefined" && !window.URL.createObjectURL) {
  window.URL.createObjectURL = () => "blob:mock";
  window.URL.revokeObjectURL = () => {};
}
