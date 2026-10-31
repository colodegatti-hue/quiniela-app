// Todo el día en una pantalla: quinielas en filas, turnos en columnas (solo la cabeza)
import { TURNOS, extractoDe, sortea } from '../util/datos.js';
import { suenoDe } from '../util/suenos.js';

const CORTOS = { ciudad: 'Ciudad', provincia: 'Provincia', santafe: 'Santa Fe', cordoba: 'Córdoba', entrerios: 'E. Ríos', mendoza: 'Mendoza', montevideo: 'Montev.', corrientes: 'Corrient.', santiago: 'Santiago', catamarca: 'Catamar.', sanluis: 'S. Luis', sanjuan: 'S. Juan', larioja: 'La Rioja', rionegro: 'R. Negro' };

export default function TablaDelDia({ datos, enVivo, jugadasCabeza, alElegir, quinielas }) {
  return (
    <div className="tabla-dia" role="table" aria-label="Cabezas de todos los turnos">
      <div className="td-fila td-cabecera" role="row">
        <span role="columnheader" />
        {TURNOS.map((t) => (
          <button key={t.id} type="button" role="columnheader" className="td-turno" onClick={() => alElegir(t.id)}>
            {t.hora}
            {enVivo.has(t.id) && <span className="vivo-punto" aria-label="en vivo" />}
          </button>
        ))}
      </div>
      {quinielas.map((q) => (
        <div key={q.id} className="td-fila" role="row">
          <span className="td-quiniela" role="rowheader">{CORTOS[q.id] ?? q.nombre}</span>
          {TURNOS.map((t) => {
            if (!sortea(q.id, t.id)) return <span key={t.id} className="td-celda td-no" role="cell" aria-label="No sortea">·</span>;
            const n = extractoDe(datos, t.id, q.id)?.[0];
            const marcado = n && jugadasCabeza(t.id, q.id, n);
            return (
              <button
                key={t.id}
                type="button"
                role="cell"
                className={`td-celda${n ? '' : ' td-vacia'}${marcado ? ' marcado' : ''}`}
                onClick={() => alElegir(t.id, q.id)}
                aria-label={n ? `${q.nombre}, ${t.nombre}: ${n}, ${suenoDe(n)?.nombre}` : `${q.nombre}, ${t.nombre}: todavía no salió`}
              >
                <span className="td-num">{n ?? '----'}</span>
                {n && <span className="td-dibujo" aria-hidden="true">{suenoDe(n)?.dibujo}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
