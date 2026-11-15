import { invokeTnbFunction } from "@/lib/api/client";
export { contactSchema } from "@/lib/contact";

export function submitContact({ data }: { data: {
  name: string;
  email: string;
  subject: string;
  message: string;
  privacy: true;
  website: string;
  elapsedMs: number;
} }): Promise<{ ok: true }> {
  return invokeTnbFunction<{ ok: true }>("tnb-contact", data);
}
