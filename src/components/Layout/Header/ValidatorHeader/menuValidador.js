// src/components/Layout/Header/ValidatorHeader/menuValidador.js
//
// Definición del menú del validador, en un módulo aparte.
//
// La comparten el header de escritorio y el panel móvil. Vive acá y no dentro
// de ValidatorHeader para que NavValidator no tenga que importar a su propio
// padre: ese ciclo funciona por las live bindings de ES modules, pero deja el
// orden de inicialización dependiendo del bundler.
//
// Ojo con las dos primeras entradas, que es fácil confundirlas:
//   Inicio               -> /validar-certificados/inicio  (portada)
//   Gestión certificados -> /validar-certificados         (escáner QR)
// La raíz es la herramienta, no la portada.

export const OPCIONES_VALIDADOR = [
  { etiqueta: "Inicio", ruta: "/validar-certificados/inicio" },
  {
    // Es la herramienta principal de la sesión, pero se dibuja como un ítem
    // más: mismo color, mismo peso y —sin icono— el mismo punto de partida del
    // texto que el resto. Un solo icono en la lista obliga a indentar ese
    // rótulo y desalinea el menú.
    etiqueta: "Gestión certificados",
    ruta: "/validar-certificados",
  },
  { etiqueta: "Gestión Cena", ruta: "/validar-cena" },
  { etiqueta: "Nosotros", ruta: "/validar-certificados/nosotros" },
  { etiqueta: "Convenios", ruta: "/validar-certificados/convenios" },
  { etiqueta: "Contacto", ruta: "/validar-certificados/contacto" },
];

/**
 * Coincidencia exacta, no por prefijo.
 *
 * /validar-certificados es prefijo de todas las demás, así que con startsWith
 * "Gestión certificados" quedaría siempre marcado como activo.
 */
export const esRutaActiva = (rutaActual, ruta) =>
  ruta === "/validar-cena"
    ? String(rutaActual || "").replace(/\/+$/, "").startsWith("/validar-cena")
    : String(rutaActual || "").replace(/\/+$/, "") === ruta;
