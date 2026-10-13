import { usePlatformSettings } from "./use-platform-settings";
import { moduleForPath, moduleVisible, type ModuleId } from "@/config/modules";

export function useModuleVisibility() {
  const query = usePlatformSettings();
  const visible = (id: ModuleId, surface: "menu" | "page" = "page") => moduleVisible(query.data?.module_visibility, id, surface);
  const visiblePath = (path: string, surface: "menu" | "page" = "page") => moduleVisible(query.data?.module_visibility, moduleForPath(path), surface);
  return { ...query, visible, visiblePath };
}