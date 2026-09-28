import { Facebook, Instagram, Linkedin, Music2, Twitter, Youtube, Radio } from "lucide-react";
import type { SocialPlatform } from "@/config/site-settings";

const MAP = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
  linkedin: Linkedin,
  x: Twitter,
  spotify: Radio,
} as const;

export function SocialIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const Icon = MAP[platform];
  return <Icon className={className} strokeWidth={1.5} />;
}
