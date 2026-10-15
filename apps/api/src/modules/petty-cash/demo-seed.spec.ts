import {
  computeAdvances,
  computeBalance,
  LedgerRow,
  toPaise,
} from './petty-cash.math';
import { buildDemoPettyCash, DEMO_SETTINGS } from './demo-seed';
import { buildForecast } from './petty-cash.forecast';

const people = {
  tenantId: 'tenant-demo',
  adminId: 'admin',
  accountantId: 'accountant',
  teacherIds: ['t1', 't2', 't3'],
};
const ymd = (d: Date) => d.toISOString().slice(0, 10);

describe.each(['2026-10-15', '2026-03-03', '2027-01-31', '2026-12-01'])(
  'demo petty cash on %s',
  (today) => {
    const data = buildDemoPettyCash(people, today);
    const approved = data.entries.filter((e) => e.status === 'APPROVED');
    const rows: LedgerRow[] = approved.map((e) => ({
      id: e.id,
      type: e.type,
      amountPaise: toPaise(e.amount),
      date: ymd(e.date),
      settlesEntryId: e.settlesEntryId,
      recipientKey: e.recipientUserId
        ? `u:${e.recipientUserId}`
        : e.payeeId
          ? `p:${e.payeeId}`
          : null,
    }));

    it('never puts the float below zero at any point in time', () => {
      const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
      // Replay day by day: all of a day's entries land before it is checked.
      const days = [...new Set(ordered.map((r) => r.date))];
      for (const day of days) {
        const upTo = ordered.filter((r) => r.date <= day);
        expect(computeBalance(upTo)).toBeGreaterThanOrEqual(0);
      }
    });

    it('settles each disbursement exactly, never over it, and only after it was given', () => {
      const advances = computeAdvances(rows, DEMO_SETTINGS.overdueDays, today);
      for (const a of advances)
        expect(a.outstandingPaise).toBeGreaterThanOrEqual(0);
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const r of rows.filter((x) => x.settlesEntryId))
        expect(r.date >= byId.get(r.settlesEntryId!)!.date).toBe(true);
    });

    it('has no future dates, no receipts missing above the limit and only valid recipients', () => {
      for (const e of data.entries) {
        expect(ymd(e.date) <= today).toBe(true);
        if (
          e.type === 'EXPENSE' &&
          Number(e.amount) > Number(DEMO_SETTINGS.receiptRequiredAbove) &&
          e.status !== 'REJECTED'
        )
          expect(e.receiptKey).toBeTruthy();
        expect(!!e.recipientUserId && !!e.payeeId).toBe(false);
        if (e.type === 'DISBURSEMENT')
          expect(!!e.recipientUserId || !!e.payeeId).toBe(true);
        if (e.settlesEntryId) expect(e.recipientUserId ?? e.payeeId).toBeNull();
        if (
          Number(e.amount) > Number(DEMO_SETTINGS.approvalThreshold) &&
          e.status === 'APPROVED'
        )
          expect(e.approvedBy).toBe('admin');
      }
      expect(data.entries.every((e) => e.tenantId === 'tenant-demo')).toBe(
        true,
      );
    });

    it('includes a pending, a rejected and a voided entry with reasons', () => {
      const pending = data.entries.filter((e) => e.status === 'PENDING');
      expect(pending).toHaveLength(1);
      expect(
        data.entries.find((e) => e.status === 'REJECTED')?.rejectionReason,
      ).toBeTruthy();
      expect(
        data.entries.find((e) => e.status === 'VOIDED')?.voidReason,
      ).toBeTruthy();
    });

    it('gives the forecast five complete months to work with', () => {
      const expenses = approved
        .filter((e) => e.type === 'EXPENSE')
        .map((e) => ({
          id: e.id,
          date: ymd(e.date),
          amountPaise: toPaise(e.amount),
          categoryId: e.categoryId,
        }));
      const forecast = buildForecast({
        today,
        balancePaise: computeBalance(rows),
        categories: data.categories.map((c) => ({
          id: c.id,
          name: c.name,
          budgetPaise: c.monthlyBudget ? toPaise(c.monthlyBudget) : null,
        })),
        monthlyBudgetPaise: toPaise(DEMO_SETTINGS.monthlyBudget),
        expenses,
        advances: computeAdvances(rows, DEMO_SETTINGS.overdueDays, today)
          .filter((a) => a.recipientKey)
          .map((a) => ({
            id: a.id,
            recipientKey: a.recipientKey!,
            recipientName: a.recipientKey!,
            date: a.date,
            amountPaise: a.amountPaise,
            outstandingPaise: a.outstandingPaise,
            lastSettledDate:
              rows
                .filter((r) => r.settlesEntryId === a.id)
                .map((r) => r.date)
                .sort()
                .pop() ?? null,
          })),
        overdueDays: DEMO_SETTINGS.overdueDays,
      });
      expect(forecast.ready).toBe(true);
      if (!forecast.ready) return;
      expect(forecast.monthsOfData).toBe(5);
      const kinds = forecast.findings.map((f) => f.kind);
      expect(kinds).toEqual(
        expect.arrayContaining([
          'CATEGORY_TRENDING_UP',
          'REPEATED_SMALL_PURCHASES',
          'OUTLIER_ENTRY',
          'LATE_SETTLEMENT',
          'OVER_BUDGET_CATEGORY',
        ]),
      );
    });
  },
);

it('is deterministic apart from generated ids', () => {
  const strip = (d: ReturnType<typeof buildDemoPettyCash>) =>
    d.entries.map((e) => [e.type, e.amount, ymd(e.date), e.status]);
  expect(strip(buildDemoPettyCash(people, '2026-10-15'))).toEqual(
    strip(buildDemoPettyCash(people, '2026-10-15')),
  );
});
