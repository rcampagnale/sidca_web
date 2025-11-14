// src/components/afiliados/index.js
export { default as AfiliadosTable } from "./AfiliadosTable.js";
export { default as EditAfiliadoDialog } from "./EditAfiliadoDialog.js";
export { default as ViewDialog } from "./ViewDialog.js";
export { default as FiltersBar } from "./FiltersBar.js";
export { default as useUsuariosSubscription } from "./hooks/useUsuariosSubscription.js";
export { default as DebugAfiliadosPanel } from "./DebugAfiliadosPanel.js";
export { default as useUsuariosOnce } from "./hooks/useUsuariosOnce.js";


// Re-exports de utilidades (todas desde un solo archivo)
export {
  toRow,
  toTimestamp,
  norm,
  departamentosOptionsFrom,
  toSiNo,
} from "./utils/shared.js";

