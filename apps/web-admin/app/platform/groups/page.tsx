'use client';

import { Building2, KeyRound, Plus, Trash2, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api-client';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { PLAN_VARIANT, PlanKey } from '../plans';

interface Group {
  id: string;
  name: string;
  schools: { id: string; name: string; slug: string; plan: PlanKey; planName: string }[];
  headOfficeUsers: { id: string; name: string; email: string | null; createdAt: string }[];
}

interface TenantLite {
  id: string;
  name: string;
  slug: string;
  groupId: string | null;
  subscription: { plan: PlanKey; planName: string };
}

const message = (err: unknown, fallback: string) => {
  if (!(err instanceof ApiError)) return fallback;
  const schools = (err.body as { error?: { schools?: string[] } })?.error?.schools;
  return schools?.length ? `${err.message}: ${schools.join(', ')}` : err.message;
};

/**
 * Franchise groups: which schools a head office sees, and its logins
 * (docs/SPEC-subscriptions.md 6). Head office access is read-only and shows
 * data only for schools on Premium or Premium Max.
 */
export default function GroupsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [tenants, setTenants] = useState<TenantLite[]>([]);
  const [naming, setNaming] = useState<Group | 'new' | null>(null);
  const [editingSchools, setEditingSchools] = useState<Group | null>(null);
  const [addingLogin, setAddingLogin] = useState<Group | null>(null);
  const [resetting, setResetting] = useState<{ group: Group; userId: string; name: string } | null>(null);

  const load = useCallback(() => {
    api.get<Group[]>('/platform/groups').then(setGroups).catch((e) => {
      setGroups([]);
      toast(message(e, 'Could not load groups'), 'error');
    });
    api.get<{ data: TenantLite[] }>('/tenants?limit=100').then((r) => setTenants(r.data)).catch(() => {});
  }, [toast]);
  useEffect(load, [load]);

  async function removeLogin(g: Group, userId: string, name: string) {
    if (!confirm(`Remove the head office login for ${name}? They are signed out at once.`)) return;
    try {
      await api.delete(`/platform/groups/${g.id}/users/${userId}`);
      toast('Login removed', 'success');
      load();
    } catch (e) {
      toast(message(e, 'Could not remove the login'), 'error');
    }
  }

  async function removeGroup(g: Group) {
    if (!confirm(`Delete the group "${g.name}"?`)) return;
    try {
      await api.delete(`/platform/groups/${g.id}`);
      toast('Group deleted', 'success');
      load();
    } catch (e) {
      toast(message(e, 'Could not delete the group'), 'error');
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">Groups</h1>
          <p className="max-w-2xl text-sm text-gray-500">
            Franchises with several schools. A head office login sees its schools side by side, read-only. Schools on Basic show
            no data there.
          </p>
        </div>
        <Button onClick={() => setNaming('new')}>
          <Plus className="h-4 w-4" />
          New group
        </Button>
      </div>

      {!groups ? (
        <div className="flex justify-center p-10">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState title="No groups yet" description="Create a group, add its schools, then give the head office a login." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <section key={g.id} className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-bold text-gray-900">{g.name}</h2>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setNaming(g)}>
                    Rename
                  </Button>
                  {g.schools.length === 0 && g.headOfficeUsers.length === 0 && (
                    <Button size="sm" variant="ghost" onClick={() => removeGroup(g)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <Building2 className="h-3.5 w-3.5" /> Schools · {g.schools.length}
                </p>
                <Button size="sm" variant="secondary" onClick={() => setEditingSchools(g)}>
                  Choose schools
                </Button>
              </div>
              {g.schools.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No schools yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-100">
                  {g.schools.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-gray-900">{s.name}</span>
                      <Badge variant={PLAN_VARIANT[s.plan]}>{s.planName}</Badge>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <UserRound className="h-3.5 w-3.5" /> Head office logins · {g.headOfficeUsers.length}
                </p>
                <Button size="sm" variant="secondary" disabled={g.schools.length === 0} onClick={() => setAddingLogin(g)}>
                  Add login
                </Button>
              </div>
              {g.headOfficeUsers.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">{g.schools.length === 0 ? 'Add a school first.' : 'No logins yet.'}</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-100">
                  {g.headOfficeUsers.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="min-w-0">
                        <span className="text-gray-900">{u.name}</span>
                        <span className="ml-2 text-xs text-gray-500">{u.email}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label={`Reset password for ${u.name}`}
                          onClick={() => setResetting({ group: g, userId: u.id, name: u.name })}
                          className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${u.name}`}
                          onClick={() => removeLogin(g, u.id, u.name)}
                          className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {naming && (
        <NameModal
          group={naming === 'new' ? null : naming}
          onClose={() => setNaming(null)}
          onDone={() => {
            setNaming(null);
            load();
          }}
        />
      )}
      {editingSchools && (
        <SchoolsModal
          group={editingSchools}
          tenants={tenants}
          onClose={() => setEditingSchools(null)}
          onDone={() => {
            setEditingSchools(null);
            load();
          }}
        />
      )}
      {addingLogin && (
        <LoginModal
          group={addingLogin}
          onClose={() => setAddingLogin(null)}
          onDone={() => {
            setAddingLogin(null);
            load();
          }}
        />
      )}
      {resetting && <PasswordModal target={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function NameModal({ group, onClose, onDone }: { group: Group | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(group?.name ?? '');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      if (group) await api.patch(`/platform/groups/${group.id}`, { name: name.trim() });
      else await api.post('/platform/groups', { name: name.trim() });
      toast(group ? 'Group renamed' : 'Group created', 'success');
      onDone();
    } catch (e) {
      toast(message(e, 'Could not save'), 'error');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={group ? 'Rename group' : 'New group'}>
      <div className="space-y-4">
        <Input label="Group name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vidya Education Trust" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={name.trim().length < 2} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SchoolsModal({
  group,
  tenants,
  onClose,
  onDone,
}: {
  group: Group;
  tenants: TenantLite[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [picked, setPicked] = useState<Set<string>>(new Set(group.schools.map((s) => s.id)));
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api.put(`/platform/groups/${group.id}/schools`, { tenantIds: [...picked] });
      toast('Schools saved', 'success');
      onDone();
    } catch (e) {
      toast(message(e, 'Could not save'), 'error');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Schools in ${group.name}`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">A school can be in one group only. Schools in another group are greyed out.</p>
        <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 bg-white">
          {tenants.map((t) => {
            const elsewhere = !!t.groupId && t.groupId !== group.id;
            return (
              <li key={t.id}>
                <label className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${elsewhere ? 'opacity-50' : 'cursor-pointer'}`}>
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-coral"
                      disabled={elsewhere}
                      checked={picked.has(t.id)}
                      onChange={() =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (next.has(t.id)) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        })
                      }
                    />
                    <span className="text-gray-900">{t.name}</span>
                    {elsewhere && <span className="text-xs text-gray-500">in another group</span>}
                  </span>
                  <Badge variant={PLAN_VARIANT[t.subscription.plan]}>{t.subscription.planName}</Badge>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save schools
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LoginModal({ group, onClose, onDone }: { group: Group; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api.post(`/platform/groups/${group.id}/users`, { name: name.trim(), email: email.trim(), password });
      toast(`Login created. ${name.trim()} signs in with this email and password, leaving the school code empty.`, 'success');
      onDone();
    } catch (e) {
      toast(message(e, 'Could not create the login'), 'error');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Head office login for ${group.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">They sign in at the console with this email and password and no school code, and see the group read-only.</p>
        <Input label="Name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} helpText="At least 8 characters. Share it with them privately." />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={name.trim().length < 2 || !email.includes('@') || password.length < 8} onClick={save}>
            Create login
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PasswordModal({ target, onClose }: { target: { group: Group; userId: string; name: string }; onClose: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api.post(`/platform/groups/${target.group.id}/users/${target.userId}/password`, { password });
      toast('Password changed; they are signed out everywhere', 'success');
      onClose();
    } catch (e) {
      toast(message(e, 'Could not change the password'), 'error');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`New password for ${target.name}`}>
      <div className="space-y-4">
        <Input label="New password" required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={password.length < 8} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
