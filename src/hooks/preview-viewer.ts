import { createContext, useContext } from "react";

// Visual Builder only: simulates who is looking at the page. It changes presentation, never the real session or permissions.
export type PreviewViewer = "guest" | "user";
export const PreviewContext = createContext<{ viewer: PreviewViewer; editing: boolean } | null>(null);
export const usePreview = () => useContext(PreviewContext);
