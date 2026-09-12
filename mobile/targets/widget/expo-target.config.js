/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: "widget",
  name: "DARTWidget",
  displayName: "DART",
  icon: "../../assets/brand/app-icon.png",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit"],
  colors: {
    $accent: "#2563EB",
    $widgetBackground: "#FFFFFF",
    DartPrimary: "#2563EB",
    DartInk: "#111827",
    DartMuted: "#64748B",
    DartWarn: "#D97706",
    DartSuccess: "#059669",
  },
  images: {
    DartMark: "../../assets/brand/dart-mark.png",
  },
  entitlements: {
    "com.apple.security.application-groups": ["group.com.app.dart"],
  },
});
