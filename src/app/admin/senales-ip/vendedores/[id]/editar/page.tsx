import FormularioVendedor from '@/components/senales-ip/FormularioVendedor';

export default async function EditarContratoVendedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormularioVendedor id={Number(id)} />;
}
