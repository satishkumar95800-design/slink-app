'use client';

import { Bus, Link2, Phone, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { getSession } from '../../../lib/auth';
import { useErrorText } from '../../../lib/i18n/errors';
import { useTenantFeaturesState } from '../../../lib/tenant-features';
import { Button } from '../../../components/ui/button';
import { Drawer } from '../../../components/ui/drawer';
import { EmptyState } from '../../../components/ui/empty-state';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { RouteFields, RouteValues, emptyRoute, routeValid, toBody } from './route-form';
import { RouteStudents } from './route-students';
import { GroundStaffCard } from './ground-staff';
import { LiveBuses } from './tracking';
import { Person, Route } from './types';

/** School bus routes (flag `transport`): admin and accounts. */
export default function SchoolBusPage() {
  const t = useTranslations('schoolBus');
  const { features, loaded } = useTenantFeaturesState();
  if (!loaded)
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  const role = getSession()?.role;
  if (role !== 'admin' && role !== 'accounts') return <EmptyState title={t('noAccess')} />;
  if (!features.transport) return <EmptyState title={t('featureOffTitle')} description={t('featureOff')} />;
  return <SchoolBus tracking={features.busTracking === true} />;
}

function SchoolBus({ tracking }: { tracking: boolean }) {
  const t = useTranslations('schoolBus');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [staff, setStaff] = useState<Person[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api
      .get<Route[]>('/transport/routes')
      .then(setRoutes)
      .catch((e) => {
        setRoutes([]);
        toast(errorText(e), 'error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadStaff = useCallback(() => {
    api.get<Person[]>('/transport/drivers').then(setStaff).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    loadStaff();
  }, [load, loadStaff]);

  const open = routes?.find((r) => r.id === openId) ?? null;
  const riders = routes?.reduce((n, r) => n + r.studentCount, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('intro')}</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          {t('addRoute')}
        </Button>
      </div>

      {!routes ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : routes.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
      ) : (
        <>
          <p className="text-sm text-gray-600">{t('summary', { routes: routes.length, students: riders })}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {routes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setOpenId(r.id)}
                className="cursor-pointer rounded-3xl border border-black/5 bg-white p-5 text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                      <Bus className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-bold text-gray-900">{r.name}</p>
                      {r.vehicleNumber && <p className="text-xs font-semibold tracking-wide text-gray-500">{r.vehicleNumber}</p>}
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-teal/10 px-2.5 py-1 text-xs font-bold text-teal">{t('studentCount', { count: r.studentCount })}</span>
                </div>
                <div className="mt-4 space-y-1 text-sm">
                  {r.driver ? (
                    <p className={`flex items-center gap-1.5 ${r.driver.isActive === false ? 'text-red-600' : 'text-gray-700'}`}>
                      <Phone className="h-3.5 w-3.5" />
                      {r.driver.isActive === false
                        ? t('driverInactive', { name: r.driver.name })
                        : r.driver.phone
                          ? t('driverLine', { name: r.driver.name, phone: r.driver.phone })
                          : t('driverNoPhone', { name: r.driver.name })}
                    </p>
                  ) : (
                    <p className="text-amber-700">{t('noDriverYet')}</p>
                  )}
                  <p className="text-gray-500">{t('stopCount', { count: r.stops.length })}</p>
                  {r.trackingUrl && (
                    <p className="flex items-center gap-1.5 text-teal">
                      <Link2 className="h-3.5 w-3.5" />
                      {t('trackingLinkSet')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className={`grid gap-5 ${tracking ? 'lg:grid-cols-2' : ''}`}>
        {tracking && <LiveBuses />}
        <GroundStaffCard tracking={tracking} onChanged={loadStaff} />
      </div>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''} subtitle={open ? t('drawerSubtitle', { students: open.studentCount, stops: open.stops.length }) : ''} icon={<Bus className="h-5 w-5" />} accent="bg-amber-100 text-amber-700">
        {open && <RouteDrawer key={open.id} route={open} staff={staff} onChanged={load} onDeleted={() => setOpenId(null)} />}
      </Drawer>

      {adding && (
        <AddRoute
          staff={staff}
          onClose={() => setAdding(false)}
          onDone={(r) => {
            setAdding(false);
            load();
            setOpenId(r.id);
          }}
        />
      )}
    </div>
  );
}

function RouteDrawer({ route, staff, onChanged, onDeleted }: { route: Route; staff: Person[]; onChanged: () => void; onDeleted: () => void }) {
  const t = useTranslations('schoolBus');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [form, setForm] = useState<RouteValues>(emptyRoute(route));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const saved = await api.put<Route>(`/transport/routes/${route.id}`, toBody(form));
      setForm(emptyRoute(saved));
      toast(t('saved'), 'success');
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api.delete(`/transport/routes/${route.id}`);
      toast(t('deleted'), 'success');
      onDeleted();
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-gray-900">{t('routeDetails')}</h3>
        <RouteFields value={form} onChange={setForm} staff={staff} />
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-700">{t('deleteConfirm')}</span>
              <Button size="sm" variant="danger" loading={saving} onClick={remove}>
                {t('delete')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t('keep')}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => setConfirmDelete(true)}>
              {t('deleteRoute')}
            </Button>
          )}
          <Button size="sm" loading={saving} disabled={!routeValid(form)} onClick={save}>
            {t('save')}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-gray-900">{t('studentsTitle', { count: route.studentCount })}</h3>
        <RouteStudents route={route} onChanged={onChanged} />
      </section>
    </div>
  );
}

function AddRoute({ staff, onClose, onDone }: { staff: Person[]; onClose: () => void; onDone: (r: Route) => void }) {
  const t = useTranslations('schoolBus');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [form, setForm] = useState<RouteValues>(emptyRoute());
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const r = await api.post<Route>('/transport/routes', toBody(form));
      toast(t('added'), 'success');
      onDone(r);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={t('addRoute')} size="lg">
      <div className="space-y-4">
        <RouteFields value={form} onChange={setForm} staff={staff} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button loading={saving} disabled={!routeValid(form)} onClick={save}>
            {t('addRoute')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
