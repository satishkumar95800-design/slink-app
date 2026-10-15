'use client';

import { ImportWorkflow } from '../../../components/import/import-workflow';
import { useTenantFeatures } from '../../../lib/tenant-features';

export default function ImportPage() {
  const { aiInsights } = useTenantFeatures();
  return <ImportWorkflow aiFix={!!aiInsights} />;
}
