import { supabase } from "@/integrations/supabase/client";
import type { PageDraft, PageSection, PageVersion, PublicPage } from "@/lib/pages";
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
 const { data, error } = await supabase.functions.invoke<T>("tnb-pages", { body });
 if (error) {
  let message=error.message||"Nie udało się wykonać operacji.";
  const context=(error as Error & {context?:unknown}).context;
  if (typeof Response!=="undefined" && context instanceof Response) {
   try { const payload=await context.clone().json() as {message?:unknown}; if(typeof payload.message==="string"&&payload.message.trim())message=payload.message; } catch {}
  }
  throw new Error(message);
 }
 if(data==null)throw new Error("Serwer zwrócił pustą odpowiedź.");
 return data;
}
export function getPublicPage(input:{data:{key?:string;slug?:string}}):Promise<PublicPage|null>{return invoke({action:"getPublicPage",data:input.data});}
export type AdminPageSummary={id:string;slug:string;system_key:string|null;title:string;status:"draft"|"published"|"archived";published_at:string|null;updated_at:string;draft_updated_at:string|null};
export function adminListPages():Promise<AdminPageSummary[]>{return invoke({action:"adminListPages"});}
export function adminGetPage(input:{data:{id:string}}):Promise<any>{return invoke({action:"adminGetPage",data:input.data});}
export function adminCheckSlug(input:{data:{slug:string;id:string|null}}):Promise<{ok:boolean;reason:string}>{return invoke({action:"adminCheckSlug",data:input.data});}
export type SavePageInput={id:string|null;system_key?:string|null;slug:string;title:string;intro:string;sections:PageSection[];seo_title:string;seo_description:string};
export function adminSavePage(input:{data:SavePageInput}):Promise<{id:string}>{return invoke({action:"adminSavePage",data:input.data});}
export function adminSetPageStatus(input:{data:{id:string;status:"draft"|"published"|"archived"}}):Promise<{ok:true}>{return invoke({action:"adminSetPageStatus",data:input.data});}
export function adminCreatePageUpload(input:{data:{id:string;type:string;size:number}}):Promise<{path:string;token:string;name:string}>{return invoke({action:"adminCreatePageUpload",data:input.data});}
export function adminPageImageUrls(input:{data:{id:string;names:string[]}}):Promise<Record<string,string>>{return invoke({action:"adminPageImageUrls",data:input.data});}
export function adminSaveDraft(input:{data:{id:string;draft:PageDraft;version:boolean}}):Promise<{savedAt:string}>{return invoke({action:"adminSaveDraft",data:input.data});}
export function adminPublishDraft(input:{data:{id:string;legalConfirmed?:boolean;expectedDigest?:string}}):Promise<{ok:true}>{return invoke({action:"adminPublishDraft",data:input.data});}
export function adminListVersions(input:{data:{id:string}}):Promise<PageVersion[]>{return invoke({action:"adminListVersions",data:input.data});}
export function adminRestoreVersion(input:{data:{id:string;versionId:string}}):Promise<{draft:PageDraft}>{return invoke({action:"adminRestoreVersion",data:input.data});}
export function adminStartHomeDraft(input:{data:{id:string;draft:PageDraft}}):Promise<{savedAt:string}>{return invoke({action:"adminStartHomeDraft",data:input.data});}
