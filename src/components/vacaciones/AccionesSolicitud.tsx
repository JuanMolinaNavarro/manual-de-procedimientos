'use client';

/**
 * Acciones de RR.HH. sobre una solicitud que comparten la bandeja y la revisión: devolver con
 * motivo, el aviso por escrito (imprimir, entregado, firmado) y «Cambiar…» sobre las aprobadas
 * (interrumpir, permutar, anular). Todo lo vuelve a validar el servidor.
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  MOTIVOS_INTERRUPCION, avisoEstado, candidatosPermuta, convenioDe, noReprog, solDe, ventanaBloqueada, type EmpleadoVac, type EstadoVac,
} from '@/lib/vacaciones-calc';
import { BOTON, CAMPO, primerNombre, rangoCorto, useOcupado } from './piezas';
import type { PropsTab } from './VacacionesPage';

type Accion = PropsTab['accion'];
interface PropsPersona { E: EstadoVac; e: EmpleadoVac; accion: Accion }

export const docUrl = (id: number, tipo: 'notificacion' | 'fraccionamiento') => `/admin/vacaciones/documento?empleadoId=${id}&tipo=${tipo}`;

// ─── Devolver ───────────────────────────────────────────────────────────────

const MOTIVOS_RAPIDOS = ['El área queda sin gente esas semanas', 'Esas fechas ya están tomadas', 'Pasá por RR.HH. y lo hablamos'];

/** Motivo de la devolución, con frases listas para tocar. La persona lo ve en Mis vacaciones. */
export function DevolverForm({ e, accion, cancelar }: { e: EmpleadoVac; accion: Accion; cancelar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const { ocupado, correr } = useOcupado();
  const nombre = primerNombre(e.nombre);
  const id = `motivo-${e.id}`;
  return (
    <div className="space-y-3 rounded-xl bg-muted p-4">
      <Label htmlFor={id} className="text-base font-semibold">¿Por qué se la devolvés? {nombre} va a leer esto.</Label>
      <div className="flex flex-wrap gap-2">
        {MOTIVOS_RAPIDOS.map((m) => (
          <button key={m} type="button" onClick={() => setMotivo(m)}
            className="min-h-10 rounded-full border border-input bg-card px-3.5 text-[15px] hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            {m}
          </button>
        ))}
      </div>
      <Textarea id={id} rows={3} className="bg-card text-base" placeholder="Escribí el motivo" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" className={BOTON} onClick={cancelar}>Cancelar</Button>
        <Button className={BOTON} disabled={ocupado || !motivo.trim()}
          onClick={() => correr(() => accion(e.id, { accion: 'devolver', motivo }, `Se la devolviste a ${nombre}`))}>
          Devolver a {nombre}
        </Button>
      </div>
    </div>
  );
}

// ─── Aviso por escrito ──────────────────────────────────────────────────────

/** Imprimir el aviso y registrar que se entregó y que lo firmó. No dibuja nada si no corresponde. */
export function BotonesAviso({ E, e, accion }: PropsPersona) {
  const { ocupado, correr } = useOcupado();
  const av = avisoEstado(E, e.id);
  if (!av?.primero || (av.notificada && av.acuse)) return null;
  return (
    <>
      <Button variant="outline" className={BOTON} asChild>
        <a href={docUrl(e.id, 'notificacion')} target="_blank" rel="noopener"><Printer className="h-5 w-5" /> Imprimir aviso</a>
      </Button>
      {av.notificada
        ? <Button className={BOTON} disabled={ocupado} onClick={() => correr(() => accion(e.id, { accion: 'acusar' }, 'Firma registrada'))}>Ya lo firmó</Button>
        : <Button className={BOTON} disabled={ocupado} onClick={() => correr(() => accion(e.id, { accion: 'notificar' }, 'Aviso registrado. Falta su firma.'))}>Ya se lo entregué</Button>}
    </>
  );
}

// ─── Cambiar unas vacaciones aprobadas ──────────────────────────────────────

type Cambio = 'anular' | 'interrumpir' | 'permutar';

export function MenuCambiar({ E, e, accion }: PropsPersona) {
  const [abierto, setAbierto] = useState<Cambio | null>(null);
  const s = solDe(E, e.id);
  const aprobada = s.estado === 'aprobada';
  const fraccionada = noReprog(s).length > 1 && !!s.acuerdoFracc;
  if (!aprobada && !fraccionada) return null;
  const cerrar = () => setAbierto(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={BOTON}>Cambiar… <ChevronDown className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 text-base">
          {s.notificacion && <DropdownMenuItem asChild><a href={docUrl(e.id, 'notificacion')} target="_blank" rel="noopener">Ver el aviso por escrito</a></DropdownMenuItem>}
          {fraccionada && <DropdownMenuItem asChild><a href={docUrl(e.id, 'fraccionamiento')} target="_blank" rel="noopener">Ver el acuerdo para dividirlas</a></DropdownMenuItem>}
          {aprobada && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setAbierto('interrumpir')}>Se enfermó durante las vacaciones…</DropdownMenuItem>
              {candidatosPermuta(E, e.id).length > 0 && <DropdownMenuItem onSelect={() => setAbierto('permutar')}>Cambiar fechas con un compañero…</DropdownMenuItem>}
              <DropdownMenuItem variant="destructive" onSelect={() => setAbierto('anular')}>Anular la aprobación…</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {abierto === 'anular' && <DialogoAnular E={E} e={e} accion={accion} cerrar={cerrar} />}
      {abierto === 'interrumpir' && <DialogoInterrumpir E={E} e={e} accion={accion} cerrar={cerrar} />}
      {abierto === 'permutar' && <DialogoPermutar E={E} e={e} accion={accion} cerrar={cerrar} />}
    </>
  );
}

interface PropsDialogo extends PropsPersona { cerrar: () => void }

/** Marco común: título, persona, contenido y el botón que confirma (cierra si sale bien). */
function DialogoAccion({ e, accion, cerrar, titulo, confirmar, destructivo, puede, body, ok, children }: {
  e: EmpleadoVac; accion: Accion; cerrar: () => void; titulo: string; confirmar: string; destructivo?: boolean;
  puede: boolean; body: Record<string, unknown>; ok: string; children: ReactNode;
}) {
  const { ocupado, correr } = useOcupado();
  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="text-base sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{titulo}</DialogTitle>
          <DialogDescription className="text-base">{e.nombre} · {e.area}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">{children}</div>
        <DialogFooter>
          <Button variant="ghost" className={BOTON} onClick={cerrar}>Cancelar</Button>
          <Button variant={destructivo ? 'destructive' : 'default'} className={BOTON} disabled={ocupado || !puede}
            onClick={() => correr(async () => { if (await accion(e.id, body, ok)) cerrar(); })}>
            {confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoAnular({ E, e, accion, cerrar }: PropsDialogo) {
  const [motivo, setMotivo] = useState('');
  const [mutuo, setMutuo] = useState(false);
  const bloqueada = ventanaBloqueada(E, e.id);
  return (
    <DialogoAccion e={e} accion={accion} cerrar={cerrar} titulo="Anular la aprobación" confirmar="Anular la aprobación" destructivo
      puede={!bloqueada || mutuo} body={{ accion: 'reabrir', motivo, mutuoAcuerdo: mutuo }} ok="Aprobación anulada">
      <p>Las fechas quedan libres y {primerNombre(e.nombre)} vuelve a elegir. Si ya tenía el aviso por escrito, queda anulado.</p>
      <div className="space-y-1.5">
        <Label htmlFor="motivo-anular" className="text-base">Motivo (opcional)</Label>
        <Textarea id="motivo-anular" rows={3} className="text-base" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
      </div>
      {bloqueada && (
        <label className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <Checkbox checked={mutuo} onCheckedChange={(c) => setMutuo(c === true)} className="mt-1" />
          <span>Ya se le avisó por escrito y faltan pocos días. Confirmo que <b>la persona está de acuerdo</b> con el cambio.</span>
        </label>
      )}
    </DialogoAccion>
  );
}

function DialogoInterrumpir({ E, e, accion, cerrar }: PropsDialogo) {
  const s = solDe(E, e.id);
  const primero = s.tramos.find((t) => t.hasta >= E.hoy) ?? s.tramos[0];
  const enCurso = !!primero && E.hoy >= primero.desde && E.hoy <= primero.hasta;
  const [f, setF] = useState({
    tramoDesde: primero?.desde ?? '', desde: enCurso ? E.hoy : primero?.desde ?? '', hasta: primero?.hasta ?? '',
    motivo: 'enfermedad', certificado: '', informada: false,
  });
  const tramo = s.tramos.find((t) => t.desde === f.tramoDesde);
  const motivos = Object.entries(MOTIVOS_INTERRUPCION).filter(([k]) => k !== 'fallecimiento' || convenioDe(E, e.id).suspFallecimiento);
  return (
    <DialogoAccion e={e} accion={accion} cerrar={cerrar} titulo="Interrumpir las vacaciones" confirmar="Registrar"
      puede={!!f.desde && !!f.hasta} body={{ accion: 'interrumpir', ...f }} ok="Interrupción registrada">
      <p className="text-muted-foreground">Los días que no pudo disfrutar se guardan para tomarlos más adelante.</p>
      {s.tramos.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-base">¿En qué parte?</Label>
          <Select value={f.tramoDesde} onValueChange={(v) => {
            const t = s.tramos.find((x) => x.desde === v);
            setF({ ...f, tramoDesde: v, desde: t?.desde ?? '', hasta: t?.hasta ?? '' });
          }}>
            <SelectTrigger className={`${CAMPO} w-full`}><SelectValue /></SelectTrigger>
            <SelectContent>{s.tramos.map((t) => <SelectItem key={t.desde} value={t.desde}>{rangoCorto(t.desde, t.hasta)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="in-desde" className="text-base">Desde</Label>
          <Input id="in-desde" type="date" className={CAMPO} min={tramo?.desde} max={tramo?.hasta} value={f.desde} onChange={(ev) => setF({ ...f, desde: ev.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="in-hasta" className="text-base">Hasta</Label>
          <Input id="in-hasta" type="date" className={CAMPO} min={f.desde} max={tramo?.hasta} value={f.hasta} onChange={(ev) => setF({ ...f, hasta: ev.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-base">Motivo</Label>
        <Select value={f.motivo} onValueChange={(v) => setF({ ...f, motivo: v })}>
          <SelectTrigger className={`${CAMPO} w-full`}><SelectValue /></SelectTrigger>
          <SelectContent>{motivos.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {f.motivo === 'enfermedad' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="in-cert" className="text-base">Certificado médico</Label>
            <Input id="in-cert" className={CAMPO} placeholder="Número o detalle" value={f.certificado} onChange={(ev) => setF({ ...f, certificado: ev.target.value })} />
          </div>
          <label className="flex items-start gap-2.5">
            <Checkbox checked={f.informada} onCheckedChange={(c) => setF({ ...f, informada: c === true })} className="mt-1" />
            <span>Avisó a tiempo y la empresa pudo hacer el control médico.</span>
          </label>
        </>
      )}
    </DialogoAccion>
  );
}

function DialogoPermutar({ E, e, accion, cerrar }: PropsDialogo) {
  const candidatos = candidatosPermuta(E, e.id);
  const [con, setCon] = useState(candidatos[0] ? String(candidatos[0].id) : '');
  return (
    <DialogoAccion e={e} accion={accion} cerrar={cerrar} titulo="Cambiar fechas con un compañero" confirmar="Intercambiar"
      puede={!!con} body={{ accion: 'permutar', con: Number(con) }} ok="Fechas intercambiadas">
      <p className="text-muted-foreground">Se intercambian las fechas aprobadas. Después hay que darles a los dos un aviso por escrito nuevo.</p>
      <Select value={con} onValueChange={setCon}>
        <SelectTrigger className={`${CAMPO} w-full`}><SelectValue placeholder="Elegí con quién" /></SelectTrigger>
        <SelectContent>
          {candidatos.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {o.nombre} · {solDe(E, o.id).tramos.map((t) => rangoCorto(t.desde, t.hasta)).join(', ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </DialogoAccion>
  );
}
