// src/components/afiliados/DebugAfiliadosPanel.js
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAfiliadosFirstPage,
  fetchAfiliadosNextPage,
  fetchAfiliadosPrevPage,
  searchAfiliadosByDniFirst,
  clearAfiliadosSearch,
  selectAfiliadosList,
  selectAfiliadosLoading,
  selectAfiliadosPage,
  selectAfiliadosHasNext,
  selectAfiliadosMode,
  selectAfiliadosSearch,
} from "../../redux/reducers/afiliadoActualizado/slice.js"; // ajusta la ruta si cambia
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";

export default function DebugAfiliadosPanel({ compact = false }) {
  const dispatch = useDispatch();

  // Estado redux
  const list     = useSelector(selectAfiliadosList);
  const loading  = useSelector(selectAfiliadosLoading);
  const page     = useSelector(selectAfiliadosPage);
  const hasNext  = useSelector(selectAfiliadosHasNext);
  const mode     = useSelector(selectAfiliadosMode);   // "browse" | "search"
  const search   = useSelector(selectAfiliadosSearch); // { term, hasNext, ... }

  // DNI para probar búsqueda
  const [dni, setDni] = useState("");

  const boxStyle = {
    border: "1px dashed var(--surface-400, #bdbdbd)",
    background: "var(--surface-50, #f9fafb)",
    padding: compact ? 10 : 16,
    borderRadius: 10,
    display: "grid",
    gap: 10,
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 8,
    alignItems: "center",
  };

  return (
    <div style={boxStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>Debug Afiliados</strong>
        <span style={{ fontSize: 12, opacity: 0.75 }}>
          {loading ? "Cargando..." : "OK"}
        </span>
      </div>

      <div style={gridStyle}>
        <div><b>mode:</b> {mode}</div>
        <div><b>page:</b> {page}</div>
        <div><b>hasNext:</b> {String(hasNext)}</div>
        <div><b>list.length:</b> {list.length}</div>
        <div><b>search.term:</b> {search?.term || "-"}</div>
        <div><b>search.hasNext:</b> {String(search?.hasNext || false)}</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          label="Primera (browse)"
          size="small"
          onClick={() => dispatch(fetchAfiliadosFirstPage())}
          disabled={loading}
        />
        <Button
          label="Anterior"
          size="small"
          onClick={() => dispatch(fetchAfiliadosPrevPage())}
          disabled={loading || page <= 1}
        />
        <Button
          label="Siguiente"
          size="small"
          onClick={() => dispatch(fetchAfiliadosNextPage())}
          disabled={loading || !hasNext}
        />
        <Button
          label="Limpiar búsqueda"
          size="small"
          severity="secondary"
          outlined
          onClick={() => dispatch(clearAfiliadosSearch()).then(() => dispatch(fetchAfiliadosFirstPage()))}
          disabled={loading}
        />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <InputText
          placeholder="DNI (min 3, solo números)"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          keyfilter="int"
          style={{ width: 220 }}
        />
        <Button
          label="Buscar DNI"
          size="small"
          onClick={() => {
            const term = (dni || "").trim();
            if (/^\d{3,}$/.test(term)) {
              dispatch(searchAfiliadosByDniFirst({ term }));
            } else {
              alert("Ingresá al menos 3 dígitos numéricos.");
            }
          }}
          disabled={loading}
        />
      </div>
    </div>
  );
}
