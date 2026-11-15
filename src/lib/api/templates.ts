import { supabase } from "@/integrations/supabase/client";
import type { PageSection } from "@/lib/pages";
export type BuilderTemplate={id:string;name:string;description:string;category:string;scope:"element"|"section"|"sections";sections:PageSection[];created_at:string;updated_at:string};
async function invoke<T>(body:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.functions.invoke<T>("tnb-templates",{body});
 if(error){
  let message=error.message||"Nie udało się wykonać operacji.";
  const context=(error as Error & {context?:unknown}).context;
  if(typeof Response!=="undefined"&&context instanceof Response){try{const payload=await context.clone().json() as {message?:unknown};if(typeof payload.message==="string"&&payload.message.trim())message=payload.message;}catch{}}
  throw new Error(message);
 }
 if(data==null)throw new Error("Serwer zwrócił pustą odpowiedź.");
 return data;
}
export function adminListTemplates():Promise<BuilderTemplate[]>{return invoke({action:"adminListTemplates"});}
export function adminCreateTemplate(input:{data:{name:string;description:string;category:string;pageId:string;scope:"element"|"section"|"sections";sections:PageSection[]}}):Promise<{id:string}>{return invoke({action:"adminCreateTemplate",data:input.data});}
export function adminUpdateTemplate(input:{data:{id:string;name:string;description:string;category:string}}):Promise<{ok:true}>{return invoke({action:"adminUpdateTemplate",data:input.data});}
export function adminDuplicateTemplate(input:{data:{id:string;name:string}}):Promise<{id:string}>{return invoke({action:"adminDuplicateTemplate",data:input.data});}
export function adminDeleteTemplate(input:{data:{id:string}}):Promise<{ok:true}>{return invoke({action:"adminDeleteTemplate",data:input.data});}
export function adminInstantiateTemplate(input:{data:{id:string;pageId:string}}):Promise<{sections:PageSection[]}>{return invoke({action:"adminInstantiateTemplate",data:input.data});}
export function adminTemplateImageUrls(input:{data:{files:{t:string;n:string}[]}}):Promise<Record<string,string>>{return invoke({action:"adminTemplateImageUrls",data:input.data});}
