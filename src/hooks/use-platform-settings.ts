import { useQuery } from "@tanstack/react-query";
import { getPublicPlatformSettings } from "@/lib/api/platform";

export function usePlatformSettings() {
  return useQuery({ queryKey: ["platform-settings-public"], queryFn: getPublicPlatformSettings, staleTime: 60_000 });
}
