// Meeting registration e-mails via the central notification engine (dispatch).
// The online link is never put in a template: participants get their private
// status page, which reveals the link only after approval.
import { fmtDate, fmtHm } from "./consult";
import { siteOrigin } from "./orders.server";

type Event = "meeting_registration" | "meeting_approved" | "meeting_rejected" | "meeting_rescheduled" | "meeting_changed" | "meeting_cancelled";
type Reg = { id: string; name: string; email: string; access_token: string };

export async function notifyRegistration(event: Event, r: Reg, startsAt: string, keySuffix = "") {
  try {
    const { dispatch } = await import("./notifications.server");
    const vars: Record<string, string> = {
      imie: r.name.split(/\s+/)[0] || r.name, data_spotkania: fmtDate(startsAt), godzina_spotkania: fmtHm(startsAt),
    };
    if (event === "meeting_approved" || event === "meeting_changed") vars["link_do_spotkania"] = `${siteOrigin()}/spotkania/zgloszenie/${r.access_token}`;
    await dispatch({ event, to: r.email, vars, idempotencyKey: `${event}-${r.id}${keySuffix}`, relatedId: r.id });
  } catch (e) {
    console.error("meeting notify failed", e instanceof Error ? e.message : e);
  }
}
