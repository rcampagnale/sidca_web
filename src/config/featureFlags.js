// src/config/featureFlags.js
//
// Interruptores para funcionalidades que están en el código pero todavía no
// se quieren mostrar al público. La página y sus rutas siguen existiendo
// (se puede entrar por URL directa para seguir desarrollando y probando),
// solo se oculta el acceso desde el menú.
//
// Para publicar una funcionalidad, poné su flag en true.

export const FEATURE_FLAGS = {
  // Gestión de Pagos (lado usuario): pendiente de terminar la integración
  // con Mercado Pago. Ruta activa: /gestion-pagos
  gestionPagosUsuario: false,
};
