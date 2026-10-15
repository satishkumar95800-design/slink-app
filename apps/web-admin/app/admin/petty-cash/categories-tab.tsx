'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatRupees } from '../../../lib/format';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { useToast } from '../../../components/ui/toast';
import type { Category } from './types';

export function CategoriesTab({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const t = useTranslations('pettyCash');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editBudget, setEditBudget] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post('/petty-cash/categories', { name: name.trim(), ...(budget ? { monthlyBudget: Number(budget) } : {}) });
      setName('');
      setBudget('');
      toast(t('categorySaved'), 'success');
      onChanged();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function patch(c: Category, body: Record<string, unknown>) {
    try {
      await api.patch(`/petty-cash/categories/${c.id}`, body);
      toast(t('categorySaved'), 'success');
      setEditing(null);
      onChanged();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  function startEdit(c: Category) {
    setEditing(c);
    setEditName(c.name);
    setEditBudget(c.monthlyBudget ?? '');
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{t('categoriesTitle')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('categoriesHelp')}</p>

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Input label={t('categoryName')} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Input label={t('monthlyBudget')} type="number" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} helpText={tCommon('optional')} />
        <Button type="submit" loading={saving} disabled={!name.trim()}>
          {tCommon('add')}
        </Button>
      </form>

      <ul className="mt-4 divide-y divide-gray-100">
        {categories.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span className="text-sm text-gray-900">
              <span className={c.isActive ? '' : 'text-gray-400'}>{c.name}</span>
              <span className="ml-3 text-gray-500">{c.monthlyBudget ? t('budgetLine', { budget: formatRupees(c.monthlyBudget) }) : t('noBudget')}</span>
              {!c.isActive && (
                <span className="ml-2">
                  <Badge variant="gray">{t('inactive')}</Badge>
                </span>
              )}
            </span>
            <span className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                {tCommon('edit')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => patch(c, { isActive: !c.isActive })}>
                {c.isActive ? t('deactivate') : t('activate')}
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t('editCategory')}>
        {editing && (
          <div className="space-y-4">
            <Input label={t('categoryName')} required maxLength={60} value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Input label={t('monthlyBudget')} type="number" min="0" step="0.01" value={editBudget} onChange={(e) => setEditBudget(e.target.value)} helpText={t('clearBudgetHelp')} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {tCommon('cancel')}
              </Button>
              <Button
                disabled={!editName.trim()}
                onClick={() => patch(editing, { name: editName.trim(), monthlyBudget: editBudget === '' ? null : Number(editBudget) })}
              >
                {tCommon('save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
