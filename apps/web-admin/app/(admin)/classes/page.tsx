import { redirect } from 'next/navigation';
export default function LegacyRedirect() {
  redirect('/admin/classes');
}
