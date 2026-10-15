'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import type { Category, Payee, Staff } from './types';

/** Categories, payees and staff the forms and filters pick from. */
export function usePettyLookups() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const reload = useCallback(() => {
    api.get<Category[]>('/petty-cash/categories?includeInactive=true').then(setCategories).catch(() => {});
    api.get<Payee[]>('/petty-cash/payees?includeInactive=true').then(setPayees).catch(() => {});
    api.get<Staff[]>('/petty-cash/staff').then(setStaff).catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { categories, payees, staff, reload };
}

export type PettyLookups = ReturnType<typeof usePettyLookups>;
