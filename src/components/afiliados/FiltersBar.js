// src/components/afiliados/FiltersBar.js
import React from "react";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";

const SOURCE_OPTIONS = [
  { label: "Ambos", value: "ambos" },
  { label: "Solo nuevoAfiliado", value: "nuevoAfiliado" },
  { label: "Solo usuarios", value: "usuarios" },
];

export default function FiltersBar({
  searchInput,
  setSearchInput,
  onSearch,
  onClear,
  onKeyDown,
  disabled,
  isPending,
  source,
  onSourceChange,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 240px auto auto",
        gap: 8,
        alignItems: "center",
      }}
    >
      <span className="p-input-icon-left" style={{ width: "100%" }}>
        <i className="pi pi-search" />
        <InputText
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)} // 👈 solo actualiza el texto
          onKeyDown={onKeyDown} // 👈 Enter dispara la búsqueda
          placeholder="Buscar por nombre, apellido o DNI"
          disabled={disabled}
          className="w-full"
          autoComplete="off"
        />
      </span>

      <Dropdown
        value={source}
        options={SOURCE_OPTIONS}
        onChange={(e) => onSourceChange(e.value)}
        disabled={disabled}
        style={{ minWidth: 240 }}
      />

      <Button
        label="Buscar"
        icon="pi pi-search"
        onClick={onSearch} // 👈 botón manual
        disabled={disabled || isPending}
      />

      <Button
        label="Limpiar"
        icon="pi pi-times"
        className="p-button-text p-button-plain"
        onClick={onClear}
        disabled={disabled && !searchInput}
      />
    </div>
  );
}
