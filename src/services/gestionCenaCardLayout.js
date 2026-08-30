export const CENA_CARD_WIDTH = 1500;
export const CENA_CARD_HEIGHT = 1071;
export const CENA_CARD_ASPECT_RATIO = CENA_CARD_WIDTH / CENA_CARD_HEIGHT;

export const CENA_CARD_LAYOUT = {
  titulo: { x: 720, top: 220, width: 900, fontSize: 80, lineHeight: 84 },
  contenido: { x: 75, width: 750, top: 386 },
  qr: { x: 937, y: 536, size: 463, darkSize: 400, quietZoneModules: 4 },
  pie: { x: 75, titularBottom: 59, acompananteBottom: 102, width: 880 },
};

const limpiarTexto = (valor) => String(valor || "").trim();

export const obtenerDatosEventoPredeterminadosCena = (anio) => ({
  nombreEvento: `Cena del Docente ${anio}`,
  lugar: "UTHGRA EVENTOS",
  fechaTexto: "SÁBADO 12 DE SEPTIEMBRE",
  horaTexto: "22 HS",
  direccion: "AV. CIRCUNVALACIÓN NÉSTOR KIRCHNER S/N",
  localidad: "VALLE VIEJO, CATAMARCA",
  organizadorTexto: "SIDCA tu Sindicato",
  sitioWeb: "www.sidca.com",
  leyendaTitular: "Tarjeta personal e intransferible. Presentar esta tarjeta junto con el DNI al momento del ingreso.",
  leyendaAcompanante: "Tarjeta individual vinculada al afiliado titular. Presentar esta tarjeta al momento del ingreso.",
});

export const formatearDniCena = (valor) => {
  const limpio = String(valor || "").replace(/\D/g, "");
  return limpio ? limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
};

export const obtenerDatosEventoCena = (edicion = {}, anio) => {
  const base = obtenerDatosEventoPredeterminadosCena(anio || edicion?.anio || new Date().getFullYear());
  return Object.keys(base).reduce((datos, campo) => ({
    ...datos,
    [campo]: limpiarTexto(edicion?.[campo]) || base[campo],
  }), {});
};
