'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import type { Category, Payee, Staff } from './types';

/** Categories, payees and staff the forms and filters pick from. */
export function usePettyLookups() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  /** The category list failed to load (shown in the forms instead of an empty list). */
  const [categoriesFailed, setCategoriesFailed] = useState(false);

  const reload = useCallback(() => {
    api
      .get<Category[]>('/petty-cash/categories?includeInactive=true')
      .then((rows) => {
        setCategories(rows);
        setCategoriesFailed(false);
      })
      .catch(() => setCategoriesFailed(true));
    api.get<Payee[]>('/petty-cash/payees?includeInactive=true').then(setPayees).catch(() => {});
    api.get<Staff[]>('/petty-cash/staff').then(setStaff).catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { categories, categoriesFailed, payees, staff, reload };
}

export type PettyLookups = ReturnType<typeof usePettyLookups>;
