import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicPlatformSettings } from "@/lib/platform.functions";

export function usePlatformSettings() {
  const fn = useServerFn(getPublicPlatformSettings);
  return useQuery({ queryKey: ["platform-settings-public"], queryFn: () => fn(), staleTime: 60_000 });
}
