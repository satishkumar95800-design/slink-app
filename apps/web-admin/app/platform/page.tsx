import { redirect } from 'next/navigation';

/** /platform opens the dashboard. */
export default function PlatformIndex() {
  redirect('/platform/dashboard');
}
