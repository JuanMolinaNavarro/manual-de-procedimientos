/**
 * Seed de datos de ejemplo para el módulo Señales IP.
 * Ejecutar con: npx ts-node prisma/seed-senales-ip.ts
 * O agregar a package.json: "prisma": { "seed": "ts-node prisma/seed-senales-ip.ts" }
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Sembrando contratos de Señales IP...');

  // ── Compradores (empresas de cable que compran las señales) ──────────────────
  const compradores = [
    {
      nombre_empresa: 'Cablevisión S.A.',
      ejecutivo_a_cargo: 'Roberto Castillo',
      mail_comercial: 'rcastillo@cablevision.com.ar',
      telefono_comercial: '+54 11 4309-5000',
      mail_tecnico: 'noc@cablevision.com.ar',
      telefono_tecnico: '+54 11 4309-5001',
      vigencia_desde: '2024-01-01',
      vigencia_hasta: '2026-12-31',
      precio_tipo: 'subs',
      precio_valor: '$3.20 por suscriptor',
      subs_minimo_garantizado: '120000',
      reportar_subs: true,
      plazas_reportadas: 'Buenos Aires, Rosario, Córdoba, La Plata',
      condiciones_pago_contrato: 'Pago a 30 días del cierre de mes. Facturación en ARS.',
      condiciones_pago_acordadas: 'Se acordó pago a 45 días por volumen. Descuento del 5% por pago anticipado.',
      tnb_aplicada: '21% IVA',
      tecnologias_autorizadas: ['Cable Digital', 'IPTV', 'OTT', 'DTH'],
      activa: true,
      created_by: 'admin',
      updated_by: 'admin',
    },
    {
      nombre_empresa: 'Telecentro S.A.',
      ejecutivo_a_cargo: 'Valeria Giménez',
      mail_comercial: 'vgimenez@telecentro.com.ar',
      telefono_comercial: '+54 11 5555-7000',
      mail_tecnico: 'noc@telecentro.com.ar',
      telefono_tecnico: '+54 11 5555-7001',
      vigencia_desde: '2024-06-01',
      vigencia_hasta: '2026-05-31',
      precio_tipo: 'fee',
      precio_valor: 'USD 18,000 mensuales',
      subs_minimo_garantizado: '60000',
      reportar_subs: false,
      plazas_reportadas: null,
      condiciones_pago_contrato: 'Fee fijo mensual. Pago en ARS al TC oficial del día 1 del mes.',
      condiciones_pago_acordadas: 'Primer trimestre bonificado al 50%.',
      tnb_aplicada: 'Exento IVA (exportación de servicios)',
      tecnologias_autorizadas: ['IPTV', 'OTT', 'Cable Digital'],
      activa: true,
      created_by: 'admin',
      updated_by: 'admin',
    },
    {
      nombre_empresa: 'Supercanal S.A.',
      ejecutivo_a_cargo: 'Federico Ríos',
      mail_comercial: 'frios@supercanal.com',
      telefono_comercial: '+54 261 420-5000',
      mail_tecnico: 'tecnico@supercanal.com',
      telefono_tecnico: '+54 261 420-5001',
      vigencia_desde: '2023-07-01',
      vigencia_hasta: '2025-12-31',
      precio_tipo: 'subs',
      precio_valor: '$2.80 por suscriptor',
      subs_minimo_garantizado: '35000',
      reportar_subs: true,
      plazas_reportadas: 'Mendoza, San Juan, San Luis',
      condiciones_pago_contrato: 'Pago mensual a 45 días del cierre.',
      condiciones_pago_acordadas: null,
      tnb_aplicada: '21% IVA',
      tecnologias_autorizadas: ['Cable Digital', 'DTH'],
      activa: true,
      created_by: 'admin',
      updated_by: 'admin',
    },
    {
      nombre_empresa: 'DirecTV Argentina S.A.',
      ejecutivo_a_cargo: 'Marcela Herrera',
      mail_comercial: 'mherrera@directv.com.ar',
      telefono_comercial: '+54 11 4500-8000',
      mail_tecnico: 'soporte.tecnico@directv.com.ar',
      telefono_tecnico: '+54 11 4500-8001',
      vigencia_desde: '2025-01-01',
      vigencia_hasta: '2027-12-31',
      precio_tipo: 'subs',
      precio_valor: '$4.10 por suscriptor',
      subs_minimo_garantizado: '200000',
      reportar_subs: true,
      plazas_reportadas: 'Todo el territorio nacional',
      condiciones_pago_contrato: 'Pago a 30 días. Facturación en USD al TC vendedor BNA.',
      condiciones_pago_acordadas: 'Precio fijo por 18 meses, sin ajuste por inflación.',
      tnb_aplicada: '21% IVA',
      tecnologias_autorizadas: ['DTH'],
      activa: true,
      created_by: 'admin',
      updated_by: 'admin',
    },
    {
      nombre_empresa: 'Claro TV Argentina',
      ejecutivo_a_cargo: 'Ignacio Peralta',
      mail_comercial: 'iperalta@claro.com.ar',
      telefono_comercial: '+54 11 6800-4500',
      mail_tecnico: 'noc.tv@claro.com.ar',
      telefono_tecnico: '+54 11 6800-4501',
      vigencia_desde: '2024-09-01',
      vigencia_hasta: '2026-08-31',
      precio_tipo: 'fee',
      precio_valor: 'USD 9,500 mensuales',
      subs_minimo_garantizado: '45000',
      reportar_subs: false,
      plazas_reportadas: null,
      condiciones_pago_contrato: 'Fee mensual fijo. Pago en USD wire transfer.',
      condiciones_pago_acordadas: 'Descuento escalonado según suscriptores activos mensuales.',
      tnb_aplicada: 'Exento IVA',
      tecnologias_autorizadas: ['IPTV', 'OTT', 'DTH'],
      activa: true,
      created_by: 'admin',
      updated_by: 'admin',
    },
  ];

  // ── Vendedores (señales/canales de TV que venden su contenido) ───────────────
  const vendedores = [
    {
      nombre_empresa: 'Warner Bros. Discovery Latin America',
      documentacion_empresa: 'EIN 95-4166766 | Representación Argentina: CUIT 30-70756894-2',
      ejecutivo_cargo: 'Daniela Montero',
      mail_comercial_cliente: 'dmontero@wbd.com',
      telefono_comercial_cliente: '+54 11 4320-7000',
      mail_tecnico_cliente: 'ops.latam@wbd.com',
      telefono_tecnico_cliente: '+54 11 4320-7001',
      vigencia_desde: '2024-01-01',
      vigencia_hasta: '2026-12-31',
      precio_tipo: 'subs',
      precio_valor: 'USD 1.20 por suscriptor',
      grilla: 'HBO, HBO2, HBO Signature, Max, Warner Channel, TNT, Space, Cartoon Network, CNN en Español, HTV',
      subs_minimo_garantizado: '500000',
      subs_reportados_senales: '520000',
      plazas_incluidas_contrato: 'Argentina completa',
      plazas_reportadas_senales: 'Argentina completa',
      condiciones_pago: 'Facturación mensual en USD. Pago dentro de los 30 días del cierre.',
      tnb_aplicada: 'Exento IVA (importación de servicios)',
      forma_recepcion_entrega: 'Uplink satelital desde Miami + fibra IP backup',
      equipos_por_senal: [
        { signal: 'HBO', equipment: 'IRD Cisco D9824' },
        { signal: 'TNT', equipment: 'IRD Ericsson RX1290' },
        { signal: 'Cartoon Network', equipment: 'IRD Harmonic HLP4100' },
        { signal: 'CNN en Español', equipment: 'IRD Harmonic HLP4100' },
      ],
      condiciones_entrega_equipamiento: 'Equipos en comodato por la vigencia del contrato. Seguro obligatorio a cargo del distribuidor.',
      activa: true,
      created_by: 'admin',
      updated_by: 'admin',
    },
    {
      nombre_empresa: 'The Walt Disney Company (Latin America)',
      documentacion_empresa: 'Representación local: CUIT 30-68029346-6 | Licencia de distribución ENACOM N° 55821',
      ejecutivo_cargo: 'Sebastián Vargas',
      mail_comercial_cliente: 'svargas@disney.com',
      telefono_comercial_cliente: '+54 11 4777-9000',
      mail_tecnico_cliente: 'broadcast.latam@disney.com',
      telefono_tecnico_cliente: '+54 11 4777-9001',
      vigencia_desde: '2024-03-01',
      vigencia_hasta: '2027-02-28',
      precio_tipo: 'subs',
      precio_valor: 'USD 1.85 por suscriptor',
      grilla: 'Disney Channel, Disney Junior, Disney XD, ESPN, ESPN2, ESPN3, ESPN Extra, National Geographic, Nat Geo Wild, Star Channel, Star+',
      subs_minimo_garantizado: '800000',
      subs_reportados_senales: '810000',
      plazas_incluidas_contrato: 'Argentina y Uruguay',
      plazas_reportadas_senales: 'Argentina completa',
      condiciones_pago: 'Pago mensual en USD. Tipo de cambio: promedio vendedor BNA del mes anterior.',
      tnb_aplicada: 'Exento IVA',
      forma_recepcion_entrega: 'Uplink satelital DSNG + entrega por fibra IP dedicada',
      equipos_por_senal: [
        { signal: 'ESPN', equipment: 'IRD Harmonic HLP4100' },
        { signal: 'ESPN2', equipment: 'IRD Harmonic HLP4100' },
        { signal: 'National Geographic', equipment: 'IRD Cisco D9854' },
        { signal: 'Disney Channel', equipment: 'IRD Cisco D9824' },
      ],
      condiciones_entrega_equipamiento: 'Equipos provistos por Disney. Comodato renovable anualmente.',
      activa: true,
      created_by: 'admin',
      updated_by: 'admin',
    },
    {
      nombre_empresa: 'Paramount Global Content Licensing',
      documentacion_empresa: 'EIN 13-1388520 | Filial Argentina: CUIT 30-71528794-1',
      ejecutivo_cargo: 'Camila Ríos',
      mail_comercial_cliente: 'crios@paramount.com',
      telefono_comercial_cliente: '+54 11 5275-3000',
      mail_tecnico_cliente: 'tech.latam@paramount.com',
      telefono_tecnico_cliente: '+54 11 5275-3001',
      vigencia_desde: '2023-10-01',
      vigencia_hasta: '2025-09-30',
      precio_tipo: 'fee',
      precio_valor: 'USD 14,500 mensuales',
      grilla: 'Nickelodeon, Nick Jr., Comedy Central, MTV, MTV Hits, Paramount Channel, BET',
      subs_minimo_garantizado: '300000',
      subs_reportados_senales: '290000',
      plazas_incluidas_contrato: 'Argentina completa',
      plazas_reportadas_senales: 'Argentina completa',
      condiciones_pago: 'Fee fijo mensual en USD. Pago a 30 días de la factura.',
      tnb_aplicada: 'Exento IVA (exportación de servicios)',
      forma_recepcion_entrega: 'Satellite uplink desde Nueva York + fibra IP redundante',
      equipos_por_senal: [
        { signal: 'Nickelodeon', equipment: 'IRD Ericsson RX1290' },
        { signal: 'MTV', equipment: 'IRD Ericsson RX1290' },
        { signal: 'Paramount Channel', equipment: 'IRD Cisco D9824' },
      ],
      condiciones_entrega_equipamiento: 'Sin comodato. Cada distribuidor debe proveer y homologar su propio IRD.',
      activa: true,
      created_by: 'admin',
      updated_by: 'admin',
    },
    {
      nombre_empresa: 'NBCUniversal Media LLC — Latin America',
      documentacion_empresa: 'EIN 04-3545232 | Representación CUIT 30-70876541-0',
      ejecutivo_cargo: 'Andrés Mansilla',
      mail_comercial_cliente: 'amansilla@nbcuni.com',
      telefono_comercial_cliente: '+54 11 4890-6000',
      mail_tecnico_cliente: 'broadcast.ops@nbcuni.com',
      telefono_tecnico_cliente: '+54 11 4890-6001',
      vigencia_desde: '2025-01-01',
      vigencia_hasta: '2027-12-31',
      precio_tipo: 'subs',
      precio_valor: 'USD 0.75 por suscriptor',
      grilla: 'Universal Channel, Syfy, E! Entertainment, Telemundo, Bravo',
      subs_minimo_garantizado: '250000',
      subs_reportados_senales: '265000',
      plazas_incluidas_contrato: 'Argentina completa',
      plazas_reportadas_senales: 'Argentina completa',
      condiciones_pago: 'Liquidación trimestral en USD. Pago a 45 días del cierre de trimestre.',
      tnb_aplicada: 'Exento IVA',
      forma_recepcion_entrega: 'Fibra óptica IP desde punto de presencia NBCUni Miami',
      equipos_por_senal: [
        { signal: 'Universal Channel', equipment: 'IRD Cisco D9854' },
        { signal: 'Syfy', equipment: 'IRD Harmonic HLP4100' },
        { signal: 'E! Entertainment', equipment: 'IRD Cisco D9824' },
      ],
      condiciones_entrega_equipamiento: 'Equipos en comodato. Mantenimiento preventivo semestral a cargo de Señales IP.',
      activa: true,
      created_by: 'admin',
      updated_by: 'admin',
    },
  ];

  // Limpiar datos existentes primero (opcional - comentar si no se quiere limpiar)
  // await prisma.saltoImporte.deleteMany();
  // await prisma.archivoContrato.deleteMany();
  // await prisma.contratoComprador.deleteMany();
  // await prisma.contratoVendedor.deleteMany();

  for (const c of compradores) {
    await prisma.contratoComprador.create({ data: c });
  }
  console.log(`✓ ${compradores.length} compradores creados`);

  for (const v of vendedores) {
    const { equipos_por_senal, ...rest } = v;
    await prisma.contratoVendedor.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ...rest, equipos_por_senal: equipos_por_senal as any },
    });
  }
  console.log(`✓ ${vendedores.length} vendedores creados`);

  // Saltos de importe de ejemplo
  const compradorCable = await prisma.contratoComprador.findFirst({ where: { nombre_empresa: 'Cablevisión S.A.' } });
  if (compradorCable) {
    await prisma.saltoImporte.create({
      data: {
        contrato_comprador_id: compradorCable.id,
        descripcion: 'Ajuste semestral por CER — cláusula 5.2 del contrato',
        fecha_efectiva: '2025-07-01',
        dias_aviso_previo: 45,
        nuevo_precio: '$3.85 por suscriptor',
        created_by: 'admin',
        updated_by: 'admin',
      },
    });
  }

  const vendedorWarner = await prisma.contratoVendedor.findFirst({ where: { nombre_empresa: { contains: 'Warner' } } });
  if (vendedorWarner) {
    await prisma.saltoImporte.create({
      data: {
        contrato_vendedor_id: vendedorWarner.id,
        descripcion: 'Incremento anual de tarifa — revisión contractual enero 2026',
        fecha_efectiva: '2026-01-01',
        dias_aviso_previo: 60,
        nuevo_precio: 'USD 1.40 por suscriptor',
        created_by: 'admin',
        updated_by: 'admin',
      },
    });
  }

  console.log('✓ Saltos de importe de ejemplo creados');
  console.log('✅ Seed completado exitosamente.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
