// Clerk component theming — matches the app's dark violet design tokens.
export const clerkAppearance = {
  variables: {
    fontFamily: "Mukta, ui-sans-serif, system-ui, sans-serif",
    colorBackground: "#16151a",
    colorInputBackground: "#232228",
    colorInputText: "#f4f4f5",
    colorText: "#f4f4f5",
    colorTextSecondary: "#a1a1aa",
    colorPrimary: "#8b5cf6",
    colorPrimaryText: "#ffffff",
    colorDanger: "#ef4444",
    colorSuccess: "#22c55e",
    colorWarning: "#eab308",
    colorBorder: "#3f3f46",
    colorMuted: "#232228",
    colorMutedForeground: "#a1a1aa",
    colorShimmer: "#8b5cf6",
    borderRadius: "0.75rem",
  },
  elements: {
    card: {
      backgroundColor: "rgba(22, 21, 26, 0.92)",
      boxShadow: "0 20px 60px -20px rgba(139, 92, 246, 0.25)",
    },
    socialButtonsBlockButton: { borderColor: "#3f3f46" },
    socialButtonsBlockButtonText: { fontWeight: "600" },
    formButtonPrimary: { fontWeight: "700" },
  },
};
