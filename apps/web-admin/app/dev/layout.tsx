import type { ReactNode } from 'react';
import { ConsoleI18nProvider } from '../../lib/i18n/provider';

export default function DevLayout({ children }: { children: ReactNode }) {
  return <ConsoleI18nProvider>{children}</ConsoleI18nProvider>;
}
