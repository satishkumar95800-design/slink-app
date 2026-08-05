// This page was moved to app/admin/page.tsx.
// app/page.tsx now redirects to /admin.
// Delete this file if Next.js reports a route conflict for "/".
import { redirect } from 'next/navigation';

export default function AdminGroupPage() {
  redirect('/admin');
}
