'use client';

/**
 * Solicitudes: la bandeja de RR.HH. Cuatro grupos según lo que falta hacer con cada persona
 * (aprobar, avisar por escrito, que elija, nada) y una acción principal por fila. Aprobar reserva
 * el cupo; después va el aviso escrito (art. 154). Todo lo vuelve a validar el servidor.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty } from '@/components/comunes/ui';
import { coincide } from '@/components/nomina/PasoCard';
import {
  aperturaDe, avisoEstado, diasDe, diffDias, noReprog, pendienteReprog, perfilDe, problemasDePersonas, solDe, turnoAbierto,
  type EmpleadoVac, type EstadoVac, type Solicitud,
} from '@/lib/vacaciones-calc';
import { cn } from '@/lib/utils';
import { BotonesAviso, DevolverForm, MenuCambiar } from './AccionesSolicitud';
import { avisosDeConfiguracion, controles, limiteAviso } from './controles';
import { BOTON, Buscador, Chip, Linea, Persona, diaMes, fechaLarga, rangoCorto, rangoLargo, sinCita, useOcupado } from './piezas';
import type { PropsTab } from './VacacionesPage';

export type Grupo = 'aprobar' | 'avisar' | 'sinElegir' | 'aprobadas';

const GRUPOS: { k: Grupo; label: string; vacio: string }[] = [
  { k: 'aprobar', label: 'Para aprobar', vacio: 'No hay solicitudes para aprobar.' },
  { k: 'avisar', label: 'Para avisar por escrito', vacio: 'No hay avisos pendientes.' },
  { k: 'sinElegir', label: 'Todavía no eligieron', vacio: 'Ya eligieron todos.' },
  { k: 'aprobadas', label: 'Aprobadas', vacio: 'Todavía no hay vacaciones aprobadas.' },
];
/** Con más filas que esto aparece el buscador. */
const FILAS_SIN_BUSCADOR = 8;
/** Un aviso por escrito que vence dentro de estos días se muestra arriba. */
const DIAS_AVISO_URGENTE = 7;

const reprogPendientes = (s: Solicitud) => s.tramos.filter((t) => t.reprog && t.estadoTramo === 'pendiente');

/** En qué grupo de la bandeja está cada persona. */
export function grupoBandeja(E: EstadoVac, id: number): Grupo {
  const s = solDe(E, id);
  if (s.estado === 'enviada' || (s.estado === 'aprobada' && reprogPendientes(s).length)) return 'aprobar';
  if (s.estado !== 'aprobada') return 'sinElegir';
  const av = avisoEstado(E, id);
  return av?.primero && (!av.notificada || !av.acuse) ? 'avisar' : 'aprobadas';
}

/** Orden de cada grupo: lo más urgente primero. */
const ORDEN: Record<Grupo, (E: EstadoVac, e: EmpleadoVac) => string> = {
  aprobar: (E, e) => solDe(E, e.id).enviada ?? '',
  avisar: (E, e) => avisoEstado(E, e.id)?.limite ?? '',
  sinElegir: (E, e) => aperturaDe(E, e.id),
  aprobadas: (E, e) => noReprog(solDe(E, e.id)).map((t) => t.desde).sort()[0] ?? '',
};

const fechasCortas = (s: Solicitud) => noReprog(s).map((t) => rangoCorto(t.desde, t.hasta)).join(' y ');

export default function SolicitudesTab({ E, visibles, accion, verSolicitud, irA }: PropsTab) {
  const [elegido, setElegido] = useState<Grupo | null>(null);
  const [buscar, setBuscar] = useState('');
  const participan = visibles.filter((e) => perfilDe(E, e.id).incluir);
  const porGrupo: Record<Grupo, EmpleadoVac[]> = { aprobar: [], avisar: [], sinElegir: [], aprobadas: [] };
  for (const e of participan) porGrupo[grupoBandeja(E, e.id)].push(e);
  const grupo = elegido ?? GRUPOS.find((g) => g.k !== 'aprobadas' && porGrupo[g.k].length)?.k ?? 'aprobadas';
  const filas = porGrupo[grupo]
    .filter((e) => coincide(e.nombre, buscar))
    .sort((a, b) => ORDEN[grupo](E, a).localeCompare(ORDEN[grupo](E, b)) || a.nombre.localeCompare(b.nombre));

  return (
    <div className="space-y-5 text-base">
      <SelectorGrupo grupo={grupo} cuentas={porGrupo} onElegir={setElegido} />
      {grupo !== 'avisar' && <AvisosUrgentes E={E} avisar={porGrupo.avisar} verAvisos={() => setElegido('avisar')} />}
      {avisosDeConfiguracion(E).map((txt) => (
        <Linea key={txt} tono="warn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{txt}</span>
            <Button variant="outline" className={BOTON} onClick={() => irA('configuracion')}>Ir a Configuración</Button>
          </div>
        </Linea>
      ))}
      <Problemas E={E} participan={participan} verSolicitud={verSolicitud} />

      {porGrupo[grupo].length > 0 && <IntroGrupo E={E} grupo={grupo} />}
      {(porGrupo[grupo].length > FILAS_SIN_BUSCADOR || buscar) && <Buscador valor={buscar} onCambio={setBuscar} className="max-w-sm" />}

      {!filas.length ? <Empty title={buscar ? 'Nadie con ese nombre' : GRUPOS.find((g) => g.k === grupo)!.vacio} /> : grupo === 'aprobar' ? (
        <div className="space-y-4">
          {filas.map((e) => <TarjetaSolicitud key={e.id} E={E} e={e} accion={accion} verSolicitud={verSolicitud} />)}
        </div>
      ) : (
        <Card className="gap-0 py-0">
          {filas.map((e, i) => (
            <div key={e.id} className={cn('flex flex-wrap items-center gap-4 px-5 py-4', i > 0 && 'border-t border-border')}>
              {grupo === 'avisar' && <FilaAviso E={E} e={e} accion={accion} />}
              {grupo === 'sinElegir' && <FilaSinElegir E={E} e={e} accion={accion} />}
              {grupo === 'aprobadas' && <FilaAprobada E={E} e={e} accion={accion} verSolicitud={verSolicitud} />}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── Encabezado de la bandeja ───────────────────────────────────────────────

function SelectorGrupo({ grupo, cuentas, onElegir }: { grupo: Grupo; cuentas: Record<Grupo, EmpleadoVac[]>; onElegir: (g: Grupo) => void }) {
  return (
    <div role="tablist" aria-label="Qué mostrar" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {GRUPOS.map((g) => (
        <button
          key={g.k}
          type="button"
          role="tab"
          aria-selected={grupo === g.k}
          onClick={() => onElegir(g.k)}
          className={cn(
            'inline-flex min-h-11 items-center gap-2.5 rounded-lg px-4 text-base font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
            grupo === g.k ? 'bg-card shadow-sm' : 'text-foreground/70 hover:text-foreground',
          )}
        >
          {g.label}
          <span className={cn(
            'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-sm font-semibold tabular-nums',
            g.k === 'aprobar' && cuentas.aprobar.length ? 'bg-primary text-primary-foreground' : 'bg-secondary',
          )}>
            {cuentas[g.k].length}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Avisos por escrito que vencen esta semana: lo único urgente que se muestra arriba. */
function AvisosUrgentes({ E, avisar, verAvisos }: { E: EstadoVac; avisar: EmpleadoVac[]; verAvisos: () => void }) {
  const urgentes = avisar.filter((e) => {
    const av = avisoEstado(E, e.id);
    return av?.limite && !av.notificada && diffDias(E.hoy, av.limite) <= DIAS_AVISO_URGENTE;
  });
  if (!urgentes.length) return null;
  const [primera] = urgentes;
  return (
    <Linea tono="warn">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {urgentes.length === 1
            ? `A ${primera.nombre} hay que avisarle por escrito antes del ${fechaLarga(avisoEstado(E, primera.id)!.limite!)}.`
            : `Hay ${urgentes.length} avisos por escrito que vencen esta semana.`}
        </span>
        <Button variant="outline" className={BOTON} onClick={verAvisos}>Ver avisos</Button>
      </div>
    </Linea>
  );
}

/** Problemas legales de personas (días sin asignar al cierre, falta de ingreso…), plegados. */
function Problemas({ E, participan, verSolicitud }: { E: EstadoVac; participan: EmpleadoVac[]; verSolicitud: PropsTab['verSolicitud'] }) {
  const ids = new Set(participan.map((e) => e.id));
  const problemas = problemasDePersonas(E).filter((p) => ids.has(p.empId));
  if (!problemas.length) return null;
  return (
    <details className="rounded-xl border border-destructive/40 px-4 py-3">
      <summary className="cursor-pointer font-medium">
        {problemas.length === 1 ? 'Hay 1 problema para revisar' : `Hay ${problemas.length} problemas para revisar`}
      </summary>
      <ul className="mt-2 space-y-1.5">
        {problemas.map((p, i) => (
          <li key={i}>
            <button type="button" className="text-left hover:underline" onClick={() => verSolicitud(p.empId)}>{sinCita(p.msg)}</button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function IntroGrupo({ E, grupo }: { E: EstadoVac; grupo: Grupo }) {
  const limite = E.config.fechaLimiteCarga;
  const texto = grupo === 'avisar' ? 'Ya están aprobadas. Falta entregarles el aviso por escrito antes de la fecha que dice cada una.'
    : grupo === 'sinElegir' ? (E.hoy > limite ? `El plazo para elegir venció el ${fechaLarga(limite)}.` : `Tienen tiempo hasta el ${fechaLarga(limite)}.`)
      : null;
  return texto && <p className="text-[17px]">{texto}</p>;
}

// ─── Filas de cada grupo ────────────────────────────────────────────────────

interface PropsFila { E: EstadoVac; e: EmpleadoVac; accion: PropsTab['accion'] }

function TarjetaSolicitud({ E, e, accion, verSolicitud }: PropsFila & { verSolicitud: PropsTab['verSolicitud'] }) {
  const [devolviendo, setDevolviendo] = useState(false);
  const { ocupado, correr } = useOcupado();
  const s = solDe(E, e.id);
  const enviada = s.estado === 'enviada';
  const tramos = enviada ? s.tramos : reprogPendientes(s);
  const ctl = enviada ? controles(E, e) : null;

  function aprobar() {
    const limite = limiteAviso(E, e.id);
    return correr(() => accion(e.id, { accion: 'aprobar' }, limite ? `Aprobada. Falta darle el aviso por escrito antes del ${diaMes(limite)}.` : 'Aprobada'));
  }

  return (
    <Card className="gap-4 px-6 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><Persona e={e} sub={`${e.area}${e.organigrama ? ` · ${e.organigrama}` : ''}`} /></div>
        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums">{tramos.reduce((a, t) => a + t.dias, 0)} días</div>
          <div className="text-[15px] text-muted-foreground">{enviada ? `de ${diasDe(E, e.id).total} que le corresponden` : 'que le quedaron pendientes'}</div>
        </div>
      </div>
      <div className="space-y-1 sm:pl-14">
        {tramos.map((t) => (
          <p key={t.desde} className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-lg font-semibold">{rangoLargo(t.desde, t.hasta)}</span>
            {tramos.length > 1 && <span className="text-muted-foreground">{t.dias} días</span>}
          </p>
        ))}
      </div>
      {ctl && <div className="sm:pl-14"><Linea tono={ctl.resumen.tono}>{ctl.resumen.txt}</Linea></div>}
      {devolviendo ? (
        <div className="sm:pl-14"><DevolverForm e={e} accion={accion} cancelar={() => setDevolviendo(false)} /></div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" className={BOTON} onClick={() => verSolicitud(e.id)}>Ver detalle</Button>
          {enviada ? (
            <>
              <Button variant="outline" className={BOTON} onClick={() => setDevolviendo(true)}>Devolver</Button>
              <Button className={BOTON} disabled={ocupado || ctl!.errores > 0} onClick={aprobar}><Check className="h-5 w-5" /> Aprobar</Button>
            </>
          ) : tramos.map((t) => (
            <Button key={t.desde} className={BOTON} disabled={ocupado}
              onClick={() => correr(() => accion(e.id, { accion: 'aprobarReprog', desde: t.desde }, 'Aprobado'))}>
              <Check className="h-5 w-5" /> Aprobar{tramos.length > 1 && ` desde el ${diaMes(t.desde)}`}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

function FilaAviso({ E, e, accion }: PropsFila) {
  const av = avisoEstado(E, e.id)!;
  const estado = av.notificada ? <Chip>Entregado, falta su firma</Chip>
    : av.tarde ? <Chip tono="error">Venció el {diaMes(av.limite!)}</Chip>
      : diffDias(E.hoy, av.limite!) <= DIAS_AVISO_URGENTE ? <Chip tono="warn">Vence el {diaMes(av.limite!)}</Chip>
        : <Chip>Hasta el {diaMes(av.limite!)}</Chip>;
  return (
    <>
      <div className="min-w-0 flex-[1_1_16rem]"><Persona e={e} sub={`${e.area} · ${fechasCortas(solDe(E, e.id))}`} /></div>
      {estado}
      <div className="flex flex-wrap gap-2">
        <BotonesAviso E={E} e={e} accion={accion} />
        <MenuCambiar E={E} e={e} accion={accion} />
      </div>
    </>
  );
}

function FilaSinElegir({ E, e, accion }: PropsFila) {
  const s = solDe(E, e.id), d = diasDe(E, e.id);
  const vencido = E.hoy > E.config.fechaLimiteCarga && !s.autorizaFueraTermino;
  const apertura = aperturaDe(E, e.id);
  const turno = E.config.criterioOrden === 'llegada' ? 'Puede elegir'
    : turnoAbierto(E, e.id) ? `Turno abierto desde el ${diaMes(apertura)}` : `Su turno abre el ${diaMes(apertura)}`;
  return (
    <>
      <div className="min-w-0 flex-[1_1_16rem]">
        <Persona e={e} sub={`${e.area} · ${d.anios === null ? 'falta su fecha de ingreso' : `le corresponden ${d.total} días`}`} />
        {s.estado === 'rechazada' && s.motivo && <p className="mt-1 pl-14 text-[15px] text-muted-foreground">Se la devolviste: «{s.motivo}»</p>}
      </div>
      {s.estado === 'rechazada' ? <Chip tono="warn">Devuelta</Chip> : vencido ? <Chip tono="error">Se le venció el plazo</Chip> : <Chip>{turno}</Chip>}
      <div className="flex flex-wrap gap-2">
        {vencido && <Button variant="ghost" className={BOTON} onClick={() => accion(e.id, { accion: 'autorizar' }, 'Ya puede mandar sus fechas')}>Darle más tiempo</Button>}
        <Button variant="outline" className={BOTON} asChild><Link href={`/admin/vacaciones/seleccion/${e.id}`}>Cargar sus fechas</Link></Button>
      </div>
    </>
  );
}

function FilaAprobada({ E, e, accion, verSolicitud }: PropsFila & { verSolicitud: PropsTab['verSolicitud'] }) {
  const pendientes = pendienteReprog(E, e.id);
  return (
    <>
      <div className="min-w-0 flex-[1_1_16rem]"><Persona e={e} sub={`${e.area} · ${fechasCortas(solDe(E, e.id))}`} /></div>
      {pendientes > 0 ? <Chip tono="warn">Le quedan {pendientes} días por reprogramar</Chip>
        : avisoEstado(E, e.id)?.primero ? <Chip tono="ok">Avisado y firmado</Chip> : <Chip>Ya se las tomó</Chip>}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" className={BOTON} onClick={() => verSolicitud(e.id)}>Ver detalle</Button>
        <MenuCambiar E={E} e={e} accion={accion} />
      </div>
    </>
  );
}
