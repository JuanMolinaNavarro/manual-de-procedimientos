import type { Metadata } from 'next';
import OrganigramaCanvas from '@/components/organigrama/OrganigramaCanvas';
import { canEditModule } from '@/lib/admin-auth';
import '@/components/organigrama/neumorphic.css';

export const metadata: Metadata = {
  title: 'Organigrama',
};

export default async function OrganigramaPage() {
  const canEdit = await canEditModule('organigrama');
  return (
    <div className="organigrama-neu neu-inset h-[calc(100vh-8rem)] overflow-hidden rounded-3xl">
      <OrganigramaCanvas canEdit={canEdit} />
    </div>
  );
}
