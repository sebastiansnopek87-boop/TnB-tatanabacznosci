import before from "@/assets/home-before-service.jpg";
import expecting from "@/assets/home-expecting-father.jpg";
import duty from "@/assets/home-duty.jpg";
import father from "@/assets/home-father.jpg";
import after from "@/assets/home-after-service.jpg";
import hero from "@/assets/hero-opt.jpg.asset.json";
import banner from "@/assets/banner-opt.jpg.asset.json";
import historia from "@/assets/card-historia.jpg.asset.json";
import biblioteka from "@/assets/card-biblioteka.jpg.asset.json";
import podcast from "@/assets/card-podcast.jpg.asset.json";
import spolecznosc from "@/assets/tile-spolecznosc.jpg.asset.json";
import spotkania from "@/assets/tile-spotkania.jpg.asset.json";
import tworczosc from "@/assets/tile-tworczosc.jpg.asset.json";
// Keys must match HOME_ASSET_KEYS in pages.ts (server validation).
export const HOME_ASSETS: Record<string, { src: string; label: string }> = {
  before: { src: before, label: "Przed służbą" }, expecting: { src: expecting, label: "Przyszły ojciec" }, duty: { src: duty, label: "W służbie" }, father: { src: father, label: "Ojciec z dziećmi" }, after: { src: after, label: "Po służbie" },
  hero: { src: hero.url, label: "Ojciec z synem w górach" }, banner: { src: banner.url, label: "Panorama gór" },
  historia: { src: historia.url, label: "Portret w ciepłym świetle" }, biblioteka: { src: biblioteka.url, label: "Książki i kubek" }, podcast: { src: podcast.url, label: "Mikrofon" },
  spolecznosc: { src: spolecznosc.url, label: "Ognisko" }, spotkania: { src: spotkania.url, label: "Chata wieczorem" }, tworczosc: { src: tworczosc.url, label: "Kompas i mapa" },
};
