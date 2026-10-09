import FormularioComprador from '@/components/senales-ip/FormularioComprador';

export default async function EditarContratoCompradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormularioComprador id={Number(id)} />;
}
