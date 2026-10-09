import FormularioBonificacion from '@/components/bonificaciones/FormularioBonificacion';

export default async function EditarBonificacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormularioBonificacion id={Number(id)} />;
}
