// src/utils/habitacionesCasaDocente.js
//
// Utilidades compartidas por la Casa del Docente (panel admin + web pública).
//
// Antes, cada habitación tenía un "tipo" fijo (simple/doble/triple/cuádruple/
// departamento) elegido de una lista cerrada, y por separado un "nombre"
// opcional. Ahora se unificaron en un solo campo: el administrador escribe
// el nombre de la habitación (ej. "Habitación 8") y el sistema deriva
// automáticamente un "tipo" (id interno usado para agrupar/filtrar) a partir
// de ese nombre. Los "tipo" fijos de antes se conservan solo como respaldo
// para mostrar el nombre de habitaciones viejas que no tengan "nombre" cargado.

export const LEGACY_TIPO_LABELS = {
  simple: "Habitación 1",
  doble: "Habitación 2",
  triple: "Habitación 3",
  cuadruple: "Habitación 4",
  departamento: "Departamento",
};

// Genera un id interno (tipo) a partir del nombre escrito por el admin.
// "Habitación 8" -> "habitacion-8". Dos habitaciones con el mismo nombre
// comparten el mismo tipo (quedan agrupadas como el mismo pool, igual que
// antes pasaba con "doble" si había dos habitaciones dobles).
export const slugifyNombreHabitacion = (valor) => {
  const base = String(valor || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `habitacion-${Date.now()}`;
};

// Nombre visible de un registro de habitación puntual.
export const nombreDeHabitacion = (habitacion) =>
  (habitacion?.nombre || "").trim() ||
  LEGACY_TIPO_LABELS[habitacion?.tipo] ||
  habitacion?.tipo ||
  "Habitación";

// Nombre visible a partir de un "tipo" (para reservas/bloqueos que solo
// guardaron el tipo, no el id de la habitación): busca una habitación real
// con ese tipo y usa su nombre; si no la encuentra, recurre al mapa histórico.
export const nombrePorTipo = (tipo, habitaciones = []) => {
  const encontrada = (habitaciones || []).find((h) => h.tipo === tipo);
  if (encontrada) return nombreDeHabitacion(encontrada);
  return LEGACY_TIPO_LABELS[tipo] || tipo || "-";
};

// Orden "natural": compara por el número que contenga el nombre (Habitación 2
// antes que Habitación 10), no alfabéticamente (donde "10" queda antes que
// "2"). Si algún nombre no tiene número, se ordena al final por alfabeto.
// Necesario porque el orden alfabético del "tipo" (slug interno) no refleja
// el orden real de las habitaciones — dos admins pueden haber escrito
// "Habitación 6" y "habitaciones 3", que alfabéticamente no quedan 3, 6.
const extraerNumero = (texto) => {
  const match = String(texto || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

export const compararNombresHabitacion = (nombreA, nombreB) => {
  const numA = extraerNumero(nombreA);
  const numB = extraerNumero(nombreB);
  if (numA !== null && numB !== null && numA !== numB) return numA - numB;
  if (numA !== null && numB === null) return -1;
  if (numA === null && numB !== null) return 1;
  return String(nombreA || "").localeCompare(String(nombreB || ""), "es", {
    sensitivity: "base",
  });
};

// Lista de opciones únicas {value: tipo, label: nombre} a partir de las
// habitaciones cargadas, para usar en selects (reservar, bloquear fechas).
// Se devuelven ya ordenadas numéricamente por nombre.
export const opcionesPorHabitacion = (habitaciones = []) => {
  const vistos = new Set();
  const opciones = [];
  (habitaciones || []).forEach((h) => {
    if (!h?.tipo || vistos.has(h.tipo)) return;
    vistos.add(h.tipo);
    opciones.push({ value: h.tipo, label: nombreDeHabitacion(h) });
  });
  return opciones.sort((a, b) => compararNombresHabitacion(a.label, b.label));
};

export const SEXO_OPCIONES = [
  { value: "F", label: "Femenino" },
  { value: "M", label: "Masculino" },
];

export const labelSexo = (sexo) =>
  SEXO_OPCIONES.find((s) => s.value === sexo)?.label || "";

// Dos reservas se superponen si comparten al menos una noche.
export const seSuperponenFechas = (ingA, egrA, ingB, egrB) =>
  egrA > ingB && ingA < egrB;

// ── Disponibilidad a nivel de PLAZA (no de habitación entera) ──
//
// Antes, disponibilidad = "¿hay algún cupo de esta categoría libre?" (contaba
// habitaciones, no personas). Ahora cada habitación tiene N camas y una
// reserva puede pedir la habitación COMPLETA (exclusiva, nadie más entra) o
// COMPARTIRLA (paga solo por sus propias plazas, y puede convivir con otras
// reservas "compartida" del MISMO sexo mientras haya camas libres).
//
// `reservasSuperpuestas` = reservas de esa habitación (mismo tipo), no
// canceladas/rechazadas, cuyas fechas se solapan con las solicitadas.
// Las reservas viejas (de antes de esta función) no tienen "modoReserva":
// se tratan como si fueran "completa" para no arriesgar un doble booking.
export const evaluarDisponibilidadHabitacion = ({
  habitacion,
  reservasSuperpuestas = [],
  modoReserva,
  sexo,
  cantidadPersonas,
}) => {
  const camas = Math.max(Number(habitacion?.camas) || 1, 1);
  const cantidadSolicitada = Math.max(Number(cantidadPersonas) || 1, 1);

  if (modoReserva === "completa") {
    if (reservasSuperpuestas.length > 0) {
      return {
        disponible: false,
        motivo:
          "Esta habitación ya tiene una reserva para esas fechas. Elegí otro rango o compartila si hay lugar.",
      };
    }
    return { disponible: true, cuposLibres: camas };
  }

  // modoReserva === "compartida"
  const hayCompletaBloqueando = reservasSuperpuestas.some(
    (r) => (r.modoReserva || "completa") === "completa"
  );
  if (hayCompletaBloqueando) {
    return {
      disponible: false,
      motivo:
        "Esta habitación está reservada de forma completa para esas fechas.",
    };
  }

  const sexoOcupante = reservasSuperpuestas.find((r) => r.sexo)?.sexo || null;
  if (sexoOcupante && sexo && sexoOcupante !== sexo) {
    return {
      disponible: false,
      motivo: `Para esas fechas la habitación ya tiene huéspedes de sexo ${labelSexo(
        sexoOcupante
      ).toLowerCase()}. Elegí otra habitación o fechas.`,
    };
  }

  const personasOcupadas = reservasSuperpuestas.reduce(
    (acc, r) => acc + (Number(r.cantidadPersonas) || 1),
    0
  );
  const cuposLibres = camas - personasOcupadas;

  if (cuposLibres < cantidadSolicitada) {
    return {
      disponible: false,
      motivo:
        cuposLibres > 0
          ? `Solo quedan ${cuposLibres} lugar(es) disponibles en esta habitación para esas fechas.`
          : "No quedan lugares disponibles en esta habitación para esas fechas.",
      cuposLibres: Math.max(cuposLibres, 0),
    };
  }

  return { disponible: true, cuposLibres };
};
