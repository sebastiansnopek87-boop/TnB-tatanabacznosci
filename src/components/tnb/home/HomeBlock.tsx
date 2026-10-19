import { Hero } from "../Hero";
import { HomeArticles, HomeConversations } from "../HomeSections";
import { QuickNav } from "../QuickNav";
import { PillarCards, PillarTiles } from "../PillarCards";
import { QuoteNewsletter } from "../QuoteNewsletter";
import { useModuleVisibility } from "@/hooks/use-module-visibility";
import { spacingClass } from "@/lib/home-content";
import { setting, type HomeBlockProps } from "./util";

// One dispatcher for home-page blocks: used by "/" and by the Visual Builder preview.
export function HomeBlock(props: HomeBlockProps) {
  const { visible } = useModuleVisibility();
  const { s } = props;
  const body = (() => {
    switch (s.kind) {
      case "home_hero": return <Hero {...props} />;
      case "home_articles": return visible("articles") ? <HomeArticles {...props} /> : null;
      case "home_community": return visible("community") ? <HomeConversations {...props} /> : null;
      case "home_quicknav": return <QuickNav {...props} />;
      case "home_pillars": return <PillarCards {...props} />;
      case "home_tiles": return <PillarTiles {...props} />;
      case "home_quote_newsletter": return <QuoteNewsletter {...props} />;
      default: return null;
    }
  })();
  const sp = spacingClass(setting(s, "spacing"));
  return sp && body ? <div className={sp}>{body}</div> : body;
}
