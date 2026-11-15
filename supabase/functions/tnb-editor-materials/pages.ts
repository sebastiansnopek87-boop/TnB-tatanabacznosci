export type PageSection = {
  id: string; kind: string; eyebrow: string; layout: "left" | "right"; display: "full" | "inset" | "featured";
  decorative: boolean; heading: string; body: string; image: string | null; imageAlt: string; caption: string; quoteAuthor: string;
  buttons: Array<{ label: string; href: string }>; items: Array<{ title: string; body: string }>; hidden?: boolean;
};
export const newSection = (kind: string = "text"): PageSection => ({
  id: Math.random().toString(36).slice(2, 10), kind, eyebrow: "", layout: "right", display: "full", decorative: false,
  heading: "", body: "", image: null, imageAlt: "", caption: "", quoteAuthor: "", buttons: [], hidden: false,
  items: kind === "columns" ? [{ title: "", body: "" }, { title: "", body: "" }] : []
});
