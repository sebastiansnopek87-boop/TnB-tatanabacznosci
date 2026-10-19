import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

// Builder-only presentation switch. It never touches the real session, roles or RLS:
// components merely render the guest/member variant, with sample data where data is personal.
export type PreviewAudience = "guest" | "member";
const Ctx = createContext<PreviewAudience | null>(null);
export const PreviewAudienceProvider = ({ value, children }: { value: PreviewAudience; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const usePreviewAudience = () => useContext(Ctx);

// signedIn: true/false, or null while the real session is still loading.
export function useDisplaySignedIn(): boolean | null {
  const preview = usePreviewAudience();
  const auth = useAuth();
  if (preview) return preview === "member";
  return auth.status === "loading" ? null : auth.status === "signed-in";
}
