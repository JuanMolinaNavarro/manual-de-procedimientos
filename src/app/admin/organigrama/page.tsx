import type { Metadata } from 'next';
import OrganigramaCanvas from '@/components/organigrama/OrganigramaCanvas';

export const metadata: Metadata = {
  title: 'Organigrama',
};

export default function OrganigramaPage() {
  return (
    <div className="h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-border bg-card">
      <OrganigramaCanvas />
    </div>
  );
}
