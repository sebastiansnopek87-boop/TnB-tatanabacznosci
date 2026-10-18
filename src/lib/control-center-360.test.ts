import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRecordSearch } from './admin-record-search';
import { historyPage, materialSearchFilter, type HistoryEvent } from './control-center';
const m = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, calls: [] as any[], error: '', auth: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => { const c: any = { middleware: () => c, inputValidator: (v: any) => { c.v = v; return c; }, handler: (h: any) => (a: any) => h({ ...a, data: c.v(a.data) }) }; return c; } }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('./admin-auth.server', () => ({ assertAdmin: m.auth }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } } } }));
import { controlCenterSearch, controlCenterHistory } from './control-center.functions';
const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222', before = '2026-10-18T18:00:00.000Z';
function client() { return { from: (table: string) => {
 let rows = [...(m.tables[table] ?? [])]; const q: any = {};
 for (const op of ['select','eq','in','ilike','or','order','limit','range','lte']) q[op] = (...args: any[]) => {
  m.calls.push({ table, op, args });
  if (op === 'eq') rows = rows.filter(r => r[args[0]] === args[1]);
  if (op === 'lte') rows = rows.filter(r => r[args[0]] <= args[1]);
  if (op === 'in') rows = rows.filter(r => args[1].includes(r[args[0]]));
  if (op === 'or' && table === 'library_items') { const [slug,title] = args[0].split(','); const exact = slug.slice(9,-1), part = title.slice(14,-2).toLowerCase(); rows = rows.filter(r => r.slug === exact || r.title.toLowerCase().includes(part)); }
  if (op === 'order') rows.sort((a,b) => args[1].ascending ? String(a[args[0]]).localeCompare(String(b[args[0]])) : String(b[args[0]]).localeCompare(String(a[args[0]])));
  if (op === 'limit') rows = rows.slice(0,args[0]); if (op === 'range') rows = rows.slice(args[0],args[1]+1); return q;
 }; q.then = (resolve: any) => Promise.resolve({ data: m.error === table ? null : rows, error: m.error === table ? true : null }).then(resolve); return q;
} }; }
const search = (q: string) => (controlCenterSearch as any)({ data: { q }, context: { supabase: client() } });
const history = (offsets = { order: 0, admin: 0, mail: 0 }) => (controlCenterHistory as any)({ data: { kind: 'order', id, offsets, before }, context: { supabase: client() } });
beforeEach(() => { m.tables = {}; m.calls = []; m.error = ''; m.auth.mockReset(); });
describe('Control Center 360', () => {
 it('validates record UUIDs and ignores absent/invalid/repeated parameters', () => { expect(adminRecordSearch({ record: id })).toEqual({ record: id }); for (const v of [undefined,'','invalid',[id],42]) expect(adminRecordSearch({ record: v })).toEqual({}); });
 it.each(['test-zakupu-etap-21','Wolę siedzieć gdy sikam','siedzieć'])('finds material by %s and queries related records', async q => {
  m.tables['library_items'] = [{ id, slug: 'test-zakupu-etap-21', title: 'Wolę siedzieć gdy sikam' }]; const r = await search(q); expect(r.materials.map((x: any) => x.id)).toEqual([id]);
  expect(m.calls).toContainEqual({ table: 'library_items', op: 'or', args: [materialSearchFilter(q)] });
  for (const table of ['library_orders','library_requests']) expect(m.calls.some(c => c.table === table && c.op === 'or' && c.args[0].includes(`item_id.in.(${id})`))).toBe(true);
  expect(m.auth).toHaveBeenCalledOnce();
 });
 it('returns empty unmatched materials', async () => { m.tables['library_items'] = [{ id, slug: 'test', title: 'Materiał' }]; expect((await search('nieistniejący')).materials).toEqual([]); });
 it('caps at 100 and marks incomplete links', async () => { m.tables['library_items'] = Array.from({ length: 102 }, (_,n) => ({ id: String(n), slug: String(n), title: 'Materiał' })); const r = await search('Materiał'); expect(r.materials).toHaveLength(100); expect(r.states.materials.limited).toBe(true); expect(r.states.orders.incomplete).toBe(true); });
 it('denies unauthorized reads before queries', async () => { m.auth.mockRejectedValueOnce(new Error('Forbidden')); await expect(history()).rejects.toThrow('Forbidden'); expect(m.calls).toEqual([]); });
 it('links mails only by exact related_id, without recipient/payload', async () => {
  m.tables['email_notification_log'] = [id,other,null].map((related_id,n) => ({ id: String(n), related_id, created_at: before, kind: 'order_paid', status: 'simulated', mode: 'test' }));
  const r = await history(); expect(r.rows.map((x: any) => x.id)).toEqual(['0']); expect(r.rows[0].source).toBe('mail'); expect(r.rows[0].result).toBe('symulacja (nie wysłano)');
  const cols = m.calls.find(c => c.table === 'email_notification_log' && c.op === 'select').args[0]; expect(cols).not.toContain('recipient'); expect(cols).not.toContain('payload');
 });
 it('pages 31 mails with a fixed boundary and no duplicates', async () => {
  m.tables['email_notification_log'] = Array.from({ length: 31 },(_,n) => ({ id: String(n), related_id: id, created_at: '2026-10-17T18:00:00.000Z', kind: 'order_paid', status: 'simulated', mode: 'test' }));
  m.tables['email_notification_log'].push({ id: 'new', related_id: id, created_at: '2026-10-19T00:00:00.000Z' });
  const a = await history(), b = await history(a.next); expect(a.rows).toHaveLength(30); expect(a.hasMore).toBe(true); expect(a.next.mail).toBe(30); expect(b.rows).toHaveLength(1); expect(b.hasMore).toBe(false); expect(b.before).toBe(before); expect(new Set([...a.rows,...b.rows].map((x: any) => x.id)).size).toBe(31);
 });
 it('exposes mail errors without cursor advance and allows empty history', async () => { m.error = 'email_notification_log'; const a = await history(); expect(a.error).toBeTruthy(); expect(a.next).toEqual({ order: 0, admin: 0, mail: 0 }); expect(a.before).toBe(before); m.error = ''; const b = await history(); expect(b.error).toBeNull(); expect(b.rows).toEqual([]); });
 it('sorts three sources, retaining distinct registry entries', () => {
  const make = (source: HistoryEvent['source'], at: string): HistoryEvent => ({ id:'same', source, at, type:'paid', actor:null, objectKind:'order', objectId:id, detail:null, result:null }); const mail = make('mail','2026-10-17T00:00:00.000Z');
  const r = historyPage([make('order',before)],[make('admin',before)],{ order:0, admin:0, mail:0 },[mail,mail]); expect(r.rows.map(x => x.source)).toEqual(['admin','order','mail']); expect(r.next).toEqual({ order:1, admin:1, mail:1 });
 });
});
