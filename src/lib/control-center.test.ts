import { describe, expect, it } from 'vitest';
import { hasAccess } from './orders.server';
import { accountMatches, accessPresentation, readState, searchParts, requestNameFilter, historyPage, HISTORY_SIZE, type HistoryEvent } from './control-center';
describe('Control Center read-only rules', () => {
  it('preserves the real 69.99 PLN paid order without using is_test for access', () => {
    const order = { amount: 6999, currency: 'PLN', is_test: false, status: 'paid', paid_at: '2026-10-02T16:01:21.066Z', access_revoked_at: null };
    expect(order.amount / 100).toBe(69.99); expect(order.currency).toBe('PLN'); expect(order.is_test).toBe(false); expect(hasAccess(order)).toBe(true);
    expect(hasAccess({ ...order, is_test: true })).toBe(true);
  });
  it('never grants access without server payment confirmation', () => { expect(hasAccess({ status: 'paid', paid_at: null, access_revoked_at: null })).toBe(false); });
  it('preserves revocation and refund access rules', () => { for (const status of ['paid','refund_pending','refunded']) { expect(hasAccess({ status, paid_at: '2026-10-02', access_revoked_at: null })).toBe(true); expect(hasAccess({ status, paid_at: '2026-10-02', access_revoked_at: '2026-10-03' })).toBe(false); } });
  it('distinguishes email candidates from identifier ownership', () => { expect(accountMatches(null, 'JAN@example.com', [{ id: 'a', email: 'jan@example.com' }, { id: 'b', email: 'other@example.com' }])).toEqual([{ userId: 'a', kind: 'email' }]); expect(accountMatches('a', 'jan@example.com', [{ id: 'a', email: 'jan@example.com' }])).toEqual([{ userId: 'a', kind: 'user_id' }]); });
  it('does not change access truth when an expiry is present', () => { const view = accessPresentation(true, '2026-01-01', Date.parse('2026-10-18')); expect(view.allowed).toBe(true); expect(view.expired).toBe(true); });
  it('distinguishes read errors from empty and limited results', () => { expect(readState(new Error('private'), 0, 100).error).toBeTruthy(); expect(readState(null, 0, 100)).toEqual({ error: null, limited: false, incomplete: false }); expect(readState(null, 101, 100).limited).toBe(true); expect(readState(null, 100, 100).limited).toBe(false); expect(readState(null, 0, 100, true).incomplete).toBe(true); });
  it('matches Jan Nowak across separate name columns and preserves slugs', () => { expect(requestNameFilter(searchParts('Jan Nowak').words)).toBe('and(first_name.ilike."%Jan%",last_name.ilike."%Nowak%")'); expect(requestNameFilter(['Jan'])).toBeNull(); expect(searchParts('test-zakupu-etap-21').safe).toBe('test-zakupu-etap-21'); expect(searchParts('wole-siedziec-gdy-sikam').safe).toBe('wole-siedziec-gdy-sikam'); });
  it('pages chronology without deleting two aspects of the same operation', () => {
    const make = (source: 'order' | 'admin', n: number): HistoryEvent => ({ id: String(n), at: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(), source, type: 'paid', actor: null, objectKind: 'order', objectId: 'a', detail: null, result: null });
    const order = Array.from({ length: 31 }, (_, n) => make('order', 31-n)); const admin = [make('admin', 31)];
    const page = historyPage(order, admin, { order: 0, admin: 0 }); expect(page.rows).toHaveLength(HISTORY_SIZE); expect(page.rows.filter((r) => r.at === order[0]?.at)).toHaveLength(2); expect(page.hasMore).toBe(true); expect(page.next).toEqual({ order: 29, admin: 1 });
    const last = historyPage(order.slice(page.next.order), [], page.next); expect(last.rows).toHaveLength(2); expect(last.hasMore).toBe(false);
  });
});
