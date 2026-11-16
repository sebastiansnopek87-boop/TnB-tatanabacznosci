import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "npm:@supabase/supabase-js@2.117.2/cors";
import { z } from "zod";
import { EVENT_MAP, DEFAULT_TEMPLATES } from "./registry.ts";
import { render, maskSensitive, stripSensitive, type Vars } from "./render.ts";

const CORS = new Headers({ ...corsHeaders, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version", "Access-Control-Max-Age": "86400", "X-Content-Type-Options": "nosniff" });
const COLS = "id, slug, title, kind, summary, description, rules, starts_at, ends_at, location, location_public, image_url, capacity, registration_open, requires_login, requires_approval, host, venue_name, address, map_url, equipment, fee_info, organizer_contact, cancellation_policy, is_outdoor, route_length, route_duration, difficulty, meeting_point, preparation, org_notes, join_open_minutes, recording_url, recording_access, cancelled_at, cancel_reason, user_can_cancel";
const ENT_COLS = "id, title, slug, kind, status, starts_at, ends_at, online_link, join_open_minutes, recording_url, address, location, meeting_point, map_url, cancelled_at, user_can_cancel";
const CONSENT = "Wyrażam zgodę na przetwarzanie moich danych (imię i nazwisko, e-mail, opcjonalnie telefon i wiadomość) w celu obsługi zgłoszenia na spotkanie TNB. Akceptuję Regulamin i Politykę prywatności.";
const EMAIL = /^[^\s@<>"]+@[^\s@<>]+\.[a-z]{2,}$/i;

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: CORS }); }
function envKey(...names: string[]): string | null {
  for (const name of names) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try { const v = JSON.parse(raw); if (typeof v === "string") return v; if (v && typeof v.default === "string") return v.default; }
    catch { return raw; }
  }
  return null;
}
function db() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new HttpError(503, "Usługa spotkań nie jest skonfigurowana.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
    headers.set("apikey", key); return fetch(input, { ...init, headers });
  } } });
}
type Db = ReturnType<typeof db>;
async function userFromRequest(s: Db, req: Request) {
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await s.auth.getUser(token);
  return !error && data.user ? data.user : null;
}
async function requireUser(s: Db, req: Request) {
  const user = await userFromRequest(s, req);
  if (!user) throw new HttpError(401, "Sesja wygasła. Zaloguj się ponownie.");
  return user;
}
async function requireAdmin(s: Db, req: Request) {
  const user = await requireUser(s, req);
  const { data, error } = await s.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (error || !data) {
    await logAdminEvent(s, { type: "access_denied", actor: user.id, objectKind: "meeting", result: "denied" });
    throw new HttpError(403, "Brak uprawnień administratora.");
  }
  return user;
}
async function logAdminEvent(s: Db, e: { type: string; actor?: string | null; objectKind?: string | null; objectId?: string | null; result?: "ok" | "failed" | "denied"; detail?: string | null }) {
  try { await s.from("admin_events").insert({ type: e.type, actor: e.actor ?? null, object_kind: e.objectKind ?? null, object_id: e.objectId ?? null, result: e.result ?? "ok", detail: e.detail?.slice(0, 300) ?? null }); }
  catch (e) { console.error("meeting admin event log failed", e); }
}
async function taken(s: Db, ids: string[]) {
  const map = new Map<string, number>();
  if (!ids.length) return map;
  const { data } = await s.from("meeting_registrations").select("meeting_id").in("meeting_id", ids).in("status", ["pending", "approved"]);
  for (const r of data ?? []) map.set(r.meeting_id, (map.get(r.meeting_id) ?? 0) + 1);
  return map;
}
function endOf(m: { starts_at: string; ends_at: string | null }) {
  return m.ends_at ? new Date(m.ends_at).getTime() : new Date(m.starts_at).getTime() + 2 * 3600_000;
}
type RegStatus = "pending" | "approved" | "rejected" | "cancelled";
type MyReg = { status: RegStatus; token: string; link: string | null; joinOpensAt: string | null; recording: string | null; address: string | null; meeting_point: string | null; map_url: string | null; canCancel: boolean };
type MeetingRecord = {
  id: string; slug: string; title: string; kind: "online" | "live"; summary: string; description: string; rules: string;
  starts_at: string; ends_at: string | null; location: string; location_public: boolean; image_url: string | null;
  capacity: number | null; registration_open: boolean; requires_login: boolean; requires_approval: boolean;
  host: string; venue_name: string; is_outdoor: boolean; cancelled_at: string | null; cancel_reason: string | null;
  recording_url: string | null; recording_access: string; fee_info: string; difficulty: string; route_length: string;
  route_duration: string; equipment: string; organizer_contact: string; cancellation_policy: string;
  preparation: string; org_notes: string; address: string; meeting_point: string; map_url: string | null;
  user_can_cancel: boolean; join_open_minutes: number; online_link: string | null; status?: string;
};
type EntitlementMeetingRecord = Pick<MeetingRecord, "id" | "title" | "slug" | "kind" | "status" | "starts_at" | "ends_at" | "online_link" | "join_open_minutes" | "recording_url" | "address" | "location" | "meeting_point" | "map_url" | "cancelled_at" | "user_can_cancel"> & { status: string };
type RegistrationLookup = { id?: string; meeting_id: string; status: string; access_token: string; user_id?: string | null; email?: string; name?: string; phone?: string | null; message?: string | null; attended?: boolean; created_at?: string; decided_at?: string | null };
type MeetingAdminRow = { id: string; slug: string; title: string; kind: string; status: string; starts_at: string; capacity: number | null; registration_open: boolean; cancelled_at: string | null; is_outdoor: boolean; online_link: string | null };
type MeetingRegistrationCount = { meeting_id: string; status: string };

function toPublic(m: MeetingRecord, count: number) {
  const pub = m.location_public, past = endOf(m) < Date.now();
  return {
    id:m.id,slug:m.slug,title:m.title,kind:m.kind,summary:m.summary,description:m.description,rules:m.rules,
    starts_at:m.starts_at,ends_at:m.ends_at,location:pub && m.location ? m.location : null,has_image:!!m.image_url,
    capacity:m.capacity,taken:count,registration_open:m.registration_open,requires_login:m.requires_login,requires_approval:m.requires_approval,
    host:m.host,venue_name:m.venue_name,is_outdoor:m.kind==="live" && m.is_outdoor,cancelled:!!m.cancelled_at,cancel_reason:m.cancel_reason,
    has_recording:!!m.recording_url && past,fee_info:m.fee_info,difficulty:m.difficulty,route_length:m.route_length,route_duration:m.route_duration,
    equipment:m.equipment,organizer_contact:m.organizer_contact,cancellation_policy:m.cancellation_policy,preparation:m.preparation,org_notes:m.org_notes,
    address:pub && m.address ? m.address : null,meeting_point:pub && m.meeting_point ? m.meeting_point : null,map_url:pub ? m.map_url : null,
    user_can_cancel:m.user_can_cancel,join_open_minutes:m.join_open_minutes,
    recording_public:past && m.recording_access==="public" ? m.recording_url : null
  };
}
function entitlement(m: EntitlementMeetingRecord, r: { status: string; access_token: string }): MyReg {
  const approved = r.status==="approved" && m.status==="published" && !m.cancelled_at;
  const start = new Date(m.starts_at).getTime(), end=endOf(m), now=Date.now(), opens=start-m.join_open_minutes*60000;
  const hasLink=approved && m.kind==="online" && !!m.online_link;
  return {
    status:(m.cancelled_at && (r.status==="pending" || r.status==="approved") ? "cancelled" : r.status) as RegStatus,
    token:r.access_token,
    link:hasLink && now>=opens && now<=end ? m.online_link : null,
    joinOpensAt:hasLink && now<opens ? new Date(opens).toISOString() : null,
    recording:approved && m.recording_url && now>end ? m.recording_url : null,
    address:approved && m.kind==="live" ? m.address || m.location || null : null,
    meeting_point:approved && m.kind==="live" ? m.meeting_point || null : null,
    map_url:approved && m.kind==="live" ? m.map_url ?? null : null,
    canCancel:(r.status==="pending" || r.status==="approved") && !m.cancelled_at && m.user_can_cancel && now<start
  };
}
async function notificationContext(s: Db) {
  const [{data:settings},{data:platform}]=await Promise.all([
    s.from("email_settings").select("*").eq("id",1).maybeSingle(),
    s.from("platform_settings").select("platform_name").eq("id",1).maybeSingle()
  ]);
  return {settings,platform:platform?.platform_name || "Tata Na Baczności"};
}
async function dispatch(s: Db,input:{event:string;to?:string|null;vars:Vars;idempotencyKey:string;relatedId?:string|null}) {
  try {
    const event=EVENT_MAP[input.event]; if(!event) return {status:"failed" as const,reason:"unknown_event"};
    const {settings,platform}=await notificationContext(s);
    const base={kind:input.event,related_id:input.relatedId ?? null,template_key:input.event,idempotency_key:input.idempotencyKey};
    const put=async(row:Record<string,unknown>)=>{
      const {data,error}=await s.from("email_notification_log").insert({...base,mode:"test",...row}).select("id").single();
      if(error){if(error.code==="23505")return null;throw error;} return data.id as string;
    };
    const enabled=event.integration==="integrated" && (await s.from("notification_rules").select("enabled").eq("event_key",input.event).maybeSingle()).data?.enabled!==false;
    if(!enabled){const id=await put({status:"skipped",reason:"notification_disabled",recipient:null});return id?{status:"skipped" as const,id,reason:"notification_disabled"}:{status:"duplicate" as const};}
    const recipient=(event.recipient==="admin"?settings?.notification_recipient:input.to)?.trim() ?? "";
    if(!EMAIL.test(recipient)){const id=await put({status:"skipped",reason:"recipient_not_configured",recipient:recipient || null});return id?{status:"skipped" as const,id,reason:"recipient_not_configured"}:{status:"duplicate" as const};}
    const def=DEFAULT_TEMPLATES[input.event]; if(!def)return {status:"failed" as const,reason:"template_not_found"};
    const {data:custom}=await s.from("email_templates").select("subject,html,text_body").eq("key",input.event).maybeSingle();
    const tpl={key:input.event,required:def.required,subject:custom?.subject ?? def.subject,html:custom?.html ?? def.html,text:custom?.text_body ?? def.text};
    const vars:Vars={...input.vars,nazwa_platformy:platform},r=render(tpl,vars,tpl.required);
    if(!r.ok){const id=await put({status:"failed",reason:"missing_variables:"+r.missing.join(","),recipient,payload:stripSensitive(input.vars),retryable:true});return id?{status:"failed" as const,id,reason:"missing_variables"}:{status:"duplicate" as const};}
    const id=await put({status:"sending",recipient,payload:stripSensitive(input.vars),retryable:!r.usesSensitive});
    if(!id)return {status:"duplicate" as const};
    const safe=render(tpl,maskSensitive(vars),tpl.required);
    await s.from("email_notification_log").update({status:"simulated",reason:null,attempts:1,mode:"test",updated_at:new Date().toISOString(),rendered_subject:safe.ok?safe.subject:null,rendered_html:safe.ok?safe.html:null,rendered_text:safe.ok?safe.text:null}).eq("id",id);
    return {status:"simulated" as const,id};
  } catch(e){console.error("meeting notification failed",e instanceof Error?e.message:e);return {status:"failed" as const,reason:"internal_error"};}
}
const origin=()=> (Deno.env.get("PUBLIC_SITE_URL") || "https://tatanabacznosci.pl").replace(/\/+$/,"");
async function notifyRegistration(s:Db,event:string,r:{id:string;name:string;email:string;access_token:string},startsAt:string,keySuffix=""){
  const vars:Record<string,string>={imie:r.name.split(/\s+/)[0] || r.name,data_spotkania:new Date(startsAt).toLocaleDateString("pl-PL",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Warsaw"}).replace(/^./,x=>x.toUpperCase()),godzina_spotkania:new Date(startsAt).toLocaleTimeString("pl-PL",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Warsaw"})};
  if(event==="meeting_approved" || event==="meeting_changed") vars["link_do_spotkania"]=origin()+"/spotkania/zgloszenie/"+r.access_token;
  await dispatch(s,{event,to:r.email,vars,idempotencyKey:event+"-"+r.id+keySuffix,relatedId:r.id});
}
const meetingInput=z.object({
  id:z.string().uuid().nullable(),
  slug:z.string().regex(/^[a-z0-9-]{1,120}$/,"Adres może zawierać małe litery, cyfry i myślniki."),
  title:z.string().trim().min(3,"Tytuł musi mieć co najmniej 3 znaki.").max(200),
  kind:z.enum(["online","live"]),
  summary:z.string().trim().max(600),description:z.string().max(20000),rules:z.string().max(5000),
  starts_at:z.string().datetime({message:"Podaj datę i godzinę."}),ends_at:z.string().datetime().nullable(),
  location:z.string().trim().max(300),location_public:z.boolean(),
  capacity:z.number().int().positive().max(100000).nullable(),
  registration_open:z.boolean(),requires_login:z.boolean(),requires_approval:z.boolean(),
  online_link:z.string().trim().max(500).refine(v=>v==="" || /^https:\/\/\S+$/.test(v),"Link musi zaczynać się od https://"),
  host:z.string().trim().max(200),venue_name:z.string().trim().max(200),address:z.string().trim().max(400),
  map_url:z.string().trim().max(500).refine(v=>v==="" || /^https:\/\/\S+$/.test(v),"Link do mapy musi zaczynać się od https://"),
  equipment:z.string().max(2000),fee_info:z.string().trim().max(500),organizer_contact:z.string().trim().max(300),
  cancellation_policy:z.string().max(2000),is_outdoor:z.boolean(),route_length:z.string().trim().max(100),route_duration:z.string().trim().max(100),
  difficulty:z.enum(["","latwa","srednia","trudna"]),meeting_point:z.string().trim().max(400),preparation:z.string().max(2000),org_notes:z.string().max(2000),
  join_open_minutes:z.number().int().min(0).max(240),user_can_cancel:z.boolean(),
  recording_url:z.string().trim().max(500).refine(v=>v==="" || /^https:\/\/\S+$/.test(v),"Link do nagrania musi zaczynać się od https://"),
  recording_access:z.enum(["participants","public"])
});
const RequestSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("listMeetings")}),
  z.object({action:z.literal("getMeeting"),data:z.object({slug:z.string().regex(/^[a-z0-9-]{1,120}$/)})}),
  z.object({action:z.literal("getMyRegistration"),data:z.object({meetingId:z.string().uuid()})}),
  z.object({action:z.literal("listMyRegistrations")}),
  z.object({action:z.literal("cancelMyRegistration"),data:z.object({token:z.string().uuid()})}),
  z.object({action:z.literal("registerForMeeting"),data:z.object({
    meetingId:z.string().uuid(),name:z.string().trim().min(3,"Podaj imię i nazwisko.").max(120),
    email:z.string().trim().toLowerCase().email("Podaj poprawny adres e-mail.").max(254),
    phone:z.string().trim().max(20).regex(/^$|^\+?[0-9 ()-]{7,20}$/,"Podaj poprawny numer telefonu.").default(""),
    message:z.string().trim().max(1000,"Wiadomość może mieć maksymalnie 1000 znaków.").default(""),
    consent:z.literal(true,{errorMap:()=>({message:"Zaakceptuj wymagane zgody."})}),
    website:z.string().max(200).default(""),elapsedMs:z.number().int().min(0).default(0)
  })}),
  z.object({action:z.literal("getRegistrationByToken"),data:z.object({token:z.string().uuid()})}),
  z.object({action:z.literal("adminListMeetings")}),
  z.object({action:z.literal("adminGetMeeting"),data:z.object({id:z.string().uuid()})}),
  z.object({action:z.literal("adminSaveMeeting"),data:meetingInput}),
  z.object({action:z.literal("adminSetMeetingStatus"),data:z.object({id:z.string().uuid(),status:z.enum(["draft","published","archived"])})}),
  z.object({action:z.literal("adminUploadMeetingImage"),data:z.object({id:z.string().uuid(),name:z.string().max(200),type:z.string().max(100),base64:z.string().max(7000000)})}),
  z.object({action:z.literal("adminRemoveMeetingImage"),data:z.object({id:z.string().uuid()})}),
  z.object({action:z.literal("adminListRegistrations"),data:z.object({meetingId:z.string().uuid()})}),
  z.object({action:z.literal("adminUpdateRegistration"),data:z.object({id:z.string().uuid(),status:z.enum(["pending","approved","rejected","cancelled"]).optional(),attended:z.boolean().optional()})}),
  z.object({action:z.literal("adminCancelMeeting"),data:z.object({id:z.string().uuid(),reason:z.string().trim().min(3,"Podaj powód odwołania.").max(500)})})
]);
const ADMIN_ACTIONS=new Set(["adminListMeetings","adminGetMeeting","adminSaveMeeting","adminSetMeetingStatus","adminUploadMeetingImage","adminRemoveMeetingImage","adminListRegistrations","adminUpdateRegistration","adminCancelMeeting"]);
const AUTH_ACTIONS=new Set(["getMyRegistration","listMyRegistrations"]);
function publicMeetingCard(d: ReturnType<typeof toPublic>) {
  return {id:d.id,slug:d.slug,title:d.title,kind:d.kind,summary:d.summary,starts_at:d.starts_at,ends_at:d.ends_at,location:d.location,has_image:d.has_image,capacity:d.capacity,taken:d.taken,registration_open:d.registration_open,requires_login:d.requires_login,requires_approval:d.requires_approval,host:d.host,venue_name:d.venue_name,is_outdoor:d.is_outdoor,cancelled:d.cancelled,cancel_reason:d.cancel_reason,has_recording:d.has_recording,fee_info:d.fee_info,difficulty:d.difficulty,route_length:d.route_length,route_duration:d.route_duration};
}
async function handle(s:Db,req:Request,raw:unknown) {
  const input=RequestSchema.parse(raw);
  const actor=ADMIN_ACTIONS.has(input.action)?await requireAdmin(s,req):AUTH_ACTIONS.has(input.action)?await requireUser(s,req):null;
  switch(input.action) {
    case "listMeetings": {
      const {data,error}=await s.from("meetings").select(COLS).eq("status","published").order("starts_at",{ascending:true}).limit(200);
      if(error)throw new HttpError(500,"Nie udało się pobrać spotkań.");
      const meetingRows = (data ?? []) as unknown as MeetingRecord[];
      const counts=await taken(s,meetingRows.map((m)=>m.id));
      return meetingRows.map((m)=>publicMeetingCard(toPublic(m,counts.get(m.id)??0)));
    }
    case "getMeeting": {
      const {data:m,error}=await s.from("meetings").select(COLS).eq("slug",input.data.slug).eq("status","published").maybeSingle();
      if(error)throw new HttpError(500,"Nie udało się pobrać spotkania.");
      if(!m)return null;
      const meeting = m as unknown as MeetingRecord;
      const counts=await taken(s,[meeting.id]);
      return toPublic(meeting,counts.get(meeting.id)??0);
    }
    case "getMyRegistration": {
      const d=input.data;
      const {data:r}=await s.from("meeting_registrations").select("status,access_token").eq("meeting_id",d.meetingId).eq("user_id",actor!.id).maybeSingle();
      if(!r)return null;
      const {data:m}=await s.from("meetings").select(ENT_COLS).eq("id",d.meetingId).maybeSingle();
      if(!m)return null;
      return entitlement(m,r);
    }
    case "listMyRegistrations": {
      const {data:regs}=await s.from("meeting_registrations").select("meeting_id,status,access_token").eq("user_id",actor!.id);
      const registrationRows = (regs ?? []) as unknown as RegistrationLookup[];
      if(!registrationRows.length)return [];
      const {data:meetings}=await s.from("meetings").select(ENT_COLS).in("id",registrationRows.map((r)=>r.meeting_id)).neq("status","draft");
      const meetingRows = (meetings ?? []) as unknown as EntitlementMeetingRecord[];
      return meetingRows.map((m)=>{
        const r=registrationRows.find((x)=>x.meeting_id===m.id)!;
        return {id:m.id,title:m.title,slug:m.status==="published"?m.slug:null,kind:m.kind,starts_at:m.starts_at,ends_at:m.ends_at,meetingCancelled:!!m.cancelled_at,ended:endOf(m)<Date.now(),...entitlement(m,r)};
      }).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
    }
    case "cancelMyRegistration": {
      const token=input.data.token;
      const {data:r}=await s.from("meeting_registrations").select("id,status,access_token,meeting_id").eq("access_token",token).maybeSingle();
      if(!r)return {error:"Nie znaleziono zgłoszenia."};
      const {data:m}=await s.from("meetings").select(ENT_COLS).eq("id",r.meeting_id).maybeSingle();
      if(!m || !entitlement(m,r).canCancel)return {error:"Rezygnacja z tego zgłoszenia nie jest już możliwa. Skontaktuj się z organizatorem."};
      const {error}=await s.from("meeting_registrations").update({status:"cancelled",decided_at:new Date().toISOString()}).eq("id",r.id).in("status",["pending","approved"]);
      await logAdminEvent(s,{type:"registration_withdrawn",actor:null,objectKind:"registration",objectId:r.id,result:error?"failed":"ok"});
      if(error)return {error:"Nie udało się anulować zgłoszenia."};
      return {ok:true as const};
    }
    case "registerForMeeting": {
      const d=input.data;
      if(d.website || d.elapsedMs<2500)return {error:"Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę."};
      const {data:m}=await s.from("meetings").select("id,status,starts_at,ends_at,registration_open,requires_login,requires_approval,cancelled_at").eq("id",d.meetingId).maybeSingle();
      if(!m || m.status!=="published")return {error:"To spotkanie nie jest dostępne."};
      if(m.cancelled_at)return {error:"To spotkanie zostało odwołane."};
      if(new Date(m.ends_at ?? m.starts_at).getTime()<Date.now())return {error:"To spotkanie już się odbyło."};
      if(!m.registration_open)return {error:"Zapisy na to spotkanie są zamknięte."};
      const user=await userFromRequest(s,req);
      if(m.requires_login && !user)return {error:"Zapisy na to spotkanie wymagają zalogowania."};
      const {data:prevRows}=await s.from("meeting_registrations").select("id,status,user_id,email").eq("meeting_id",m.id);
      const previousRows = (prevRows ?? []) as unknown as RegistrationLookup[];
      const prev=previousRows.find((r)=>(user && r.user_id===user.id) || (r.email ?? "").toLowerCase()===d.email);
      if(prev && prev.status!=="cancelled")return {error:user && prev.user_id===user.id?"Z tego konta wysłano już zgłoszenie na to spotkanie.":"Na ten adres e-mail wysłano już zgłoszenie na to spotkanie."};
      const {count:recent}=await s.from("meeting_registrations").select("id",{count:"exact",head:true}).ilike("email",d.email).gte("created_at",new Date(Date.now()-3600000).toISOString());
      if((recent??0)>=5)return {error:"Wysłano zbyt wiele zgłoszeń z tego adresu. Spróbuj później."};
      const status=m.requires_approval?"pending":"approved",now=new Date().toISOString();
      const row={user_id:user?.id ?? null,name:d.name,email:d.email,phone:d.phone || null,message:d.message || null,consent_text:CONSENT,status,decided_at:status==="approved"?now:null,decided_by:null};
      const {data:r,error}=prev
        ? await s.from("meeting_registrations").update(row).eq("id",prev.id).eq("status","cancelled").select("id,access_token").single()
        : await s.from("meeting_registrations").insert({...row,meeting_id:m.id}).select("id,access_token").single();
      if(error){
        if(error.code==="23505")return {error:"Na ten adres e-mail wysłano już zgłoszenie na to spotkanie."};
        if(/meeting_full/.test(error.message))return {error:"Brak wolnych miejsc na to spotkanie."};
        console.error("meeting registration failed",error.message);
        return {error:"Nie udało się wysłać zgłoszenia. Spróbuj ponownie."};
      }
      await notifyRegistration(s,status==="approved"?"meeting_approved":"meeting_registration",{id:r.id,name:d.name,email:d.email,access_token:r.access_token},m.starts_at);
      return {token:r.access_token,status};
    }
    case "getRegistrationByToken": {
      const {data:r}=await s.from("meeting_registrations").select("status,name,meeting_id,access_token").eq("access_token",input.data.token).maybeSingle();
      if(!r)return null;
      const {data:m}=await s.from("meetings").select(ENT_COLS+",location_public,cancel_reason").eq("id",r.meeting_id).maybeSingle();
      if(!m)return null;
      const e=entitlement(m,r);
      return {...e,name:r.name,title:m.title,slug:m.status==="published"?m.slug:null,kind:m.kind,starts_at:m.starts_at,ends_at:m.ends_at,meetingCancelled:!!m.cancelled_at,cancel_reason:m.cancel_reason,ended:endOf(m)<Date.now(),location:e.address ?? (m.location_public && m.location ? m.location : null)};
    }
    case "adminListMeetings": {
      const {data,error}=await s.from("meetings").select("id,slug,title,kind,status,starts_at,capacity,registration_open,cancelled_at,is_outdoor,online_link").order("starts_at",{ascending:false});
      if(error)throw new HttpError(500,"Nie udało się wczytać spotkań.");
      const {data:regs}=await s.from("meeting_registrations").select("meeting_id,status");
      const meetingRows = (data ?? []) as unknown as MeetingAdminRow[];
      const registrationRows = (regs ?? []) as unknown as MeetingRegistrationCount[];
      return meetingRows.map((m)=>{
        const rs=registrationRows.filter((r)=>r.meeting_id===m.id),c=(status:string)=>rs.filter((r)=>r.status===status).length;
        return {...m,total:rs.length,pending:c("pending"),approved:c("approved"),rejected:c("rejected")};
      });
    }
    case "adminGetMeeting": {
      const {data:m,error}=await s.from("meetings").select("*").eq("id",input.data.id).maybeSingle();
      if(error || !m)throw new HttpError(404,"Nie znaleziono spotkania.");
      return m;
    }
    case "adminSaveMeeting": {
      const d=input.data;
      if(d.ends_at && new Date(d.ends_at)<=new Date(d.starts_at))throw new HttpError(400,"Zakończenie musi być późniejsze niż rozpoczęcie.");
      const {id,online_link,map_url,recording_url,...rest}=d;
      if(rest.kind==="online")rest.is_outdoor=false;
      const {data:prev}=id?await s.from("meetings").select("starts_at,location,address,meeting_point,cancelled_at").eq("id",id).maybeSingle():{data:null};
      if(prev?.cancelled_at)throw new HttpError(409,"Spotkanie jest odwołane — nie można go edytować.");
      const row={...rest,online_link:online_link || null,map_url:map_url || null,recording_url:recording_url || null};
      const query=id?s.from("meetings").update(row).eq("id",id).select("id").single():s.from("meetings").insert(row).select("id").single();
      const {data:saved,error}=await query;
      await logAdminEvent(s,{type:id?"meeting_edit":"meeting_create",actor:actor!.id,objectKind:"meeting",objectId:saved?.id ?? id ?? undefined,result:error?"failed":"ok",detail:rest.title});
      if(error)throw new HttpError(500,error.code==="23505"?"Spotkanie o takim adresie już istnieje.":"Nie udało się zapisać spotkania.");
      const minute=(v:string)=>Math.floor(new Date(v).getTime()/60000);
      const dateChanged=prev && minute(prev.starts_at)!==minute(rest.starts_at);
      const placeChanged=prev && (prev.location!==rest.location || prev.address!==rest.address || prev.meeting_point!==rest.meeting_point);
      if(dateChanged || placeChanged){
        const {data:regs}=await s.from("meeting_registrations").select("id,name,email,access_token").eq("meeting_id",id!).in("status",["pending","approved"]);
        const key="-"+new Date(rest.starts_at).getTime()+"-"+(rest.address+rest.location+rest.meeting_point).length;
        for(const r of regs??[])await notifyRegistration(s,dateChanged?"meeting_rescheduled":"meeting_changed",r,rest.starts_at,key);
      }
      return {id:saved.id as string};
    }
    case "adminSetMeetingStatus": {
      const patch: { status: string; published_at?: string }={status:input.data.status};if(input.data.status==="published")patch.published_at=new Date().toISOString();
      const {error}=await s.from("meetings").update(patch).eq("id",input.data.id);
      await logAdminEvent(s,{type:"meeting_"+input.data.status,actor:actor!.id,objectKind:"meeting",objectId:input.data.id,result:error?"failed":"ok"});
      if(error)throw new HttpError(500,"Nie udało się zmienić statusu.");
      return {ok:true};
    }
    case "adminUploadMeetingImage": {
      const d=input.data;
      if(!["image/jpeg","image/png","image/webp"].includes(d.type))throw new HttpError(400,"Grafika musi być plikiem JPG, PNG lub WEBP.");
      let bytes:Uint8Array;
      try {const raw=atob(d.base64);bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));} catch {throw new HttpError(400,"Nieprawidłowy plik graficzny.");}
      if(bytes.byteLength>5*1024*1024)throw new HttpError(413,"Grafika może mieć maksymalnie 5 MB.");
      const ext=(d.type.split("/")[1]??"jpg").replace("jpeg","jpg"),path=d.id+"/"+Date.now()+"."+ext;
      const up=await s.storage.from("meeting-images").upload(path,bytes,{contentType:d.type});
      if(up.error)throw new HttpError(500,"Nie udało się przesłać grafiki.");
      const {error}=await s.from("meetings").update({image_url:path}).eq("id",d.id);
      if(error)throw new HttpError(500,"Nie udało się przypisać grafiki.");
      return {ok:true};
    }
    case "adminRemoveMeetingImage": {
      const {error}=await s.from("meetings").update({image_url:null}).eq("id",input.data.id);
      if(error)throw new HttpError(500,"Nie udało się usunąć grafiki.");
      return {ok:true};
    }
    case "adminListRegistrations": {
      const {data,error}=await s.from("meeting_registrations").select("id,name,email,phone,message,status,attended,user_id,created_at,decided_at").eq("meeting_id",input.data.meetingId).order("created_at");
      if(error)throw new HttpError(500,"Nie udało się wczytać zgłoszeń.");
      return data ?? [];
    }
    case "adminUpdateRegistration": {
      const d=input.data,patch: { status?: string; decided_at?: string; decided_by?: string; attended?: boolean } = {};
      if(d.status)Object.assign(patch,{status:d.status,decided_at:new Date().toISOString(),decided_by:actor!.id});
      if(d.attended!==undefined)patch.attended=d.attended;
      const {data:before}=await s.from("meeting_registrations").select("status,meeting_id").eq("id",d.id).maybeSingle();
      if(d.status && d.status!=="cancelled" && before){
        const {data:mm}=await s.from("meetings").select("cancelled_at").eq("id",before.meeting_id).maybeSingle();
        if(mm?.cancelled_at)throw new HttpError(409,"Spotkanie jest odwołane — nie można zmieniać zgłoszeń.");
      }
      const {error}=await s.from("meeting_registrations").update(patch).eq("id",d.id);
      await logAdminEvent(s,{type:d.status?"registration_"+d.status:"registration_attendance",actor:actor!.id,objectKind:"registration",objectId:d.id,result:error?"failed":"ok"});
      if(error)throw new HttpError(500,/meeting_full/.test(error.message)?"Brak wolnych miejsc — limit uczestników został osiągnięty.":"Nie udało się zaktualizować zgłoszenia.");
      if((d.status==="approved" || d.status==="rejected") && before?.status!==d.status){
        const {data:r}=await s.from("meeting_registrations").select("id,name,email,access_token,meeting_id").eq("id",d.id).maybeSingle();
        const {data:m}=r?await s.from("meetings").select("starts_at").eq("id",r.meeting_id).maybeSingle():{data:null};
        if(r && m)await notifyRegistration(s,d.status==="approved"?"meeting_approved":"meeting_rejected",r,m.starts_at);
      }
      return {ok:true};
    }
    case "adminCancelMeeting": {
      const d=input.data,now=new Date().toISOString();
      const {data:m,error}=await s.from("meetings").update({cancelled_at:now,cancel_reason:d.reason,registration_open:false}).eq("id",d.id).is("cancelled_at",null).select("id,starts_at").maybeSingle();
      await logAdminEvent(s,{type:"meeting_cancelled",actor:actor!.id,objectKind:"meeting",objectId:d.id,result:error || !m?"failed":"ok",detail:d.reason});
      if(error || !m)throw new HttpError(409,"Nie udało się odwołać spotkania (może jest już odwołane).");
      const {data:regs}=await s.from("meeting_registrations").update({status:"cancelled",decided_at:now,decided_by:actor!.id}).eq("meeting_id",d.id).in("status",["pending","approved"]).select("id,name,email,access_token");
      for(const r of regs??[])await notifyRegistration(s,"meeting_cancelled",r,m.starts_at);
      return {ok:true,affected:regs?.length ?? 0};
    }
  }
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return json({message:"Niedozwolona metoda."},405);
  try{const s=db(),body=await req.json().catch(()=>null);return json(await handle(s,req,body));}
  catch(e){const status=e instanceof HttpError?e.status:e instanceof z.ZodError?400:500;const message=e instanceof Error?e.message:"Wystąpił błąd serwera.";if(status>=500)console.error("tnb-meetings:",message);return json({message},status);}
});
