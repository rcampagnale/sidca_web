// src/components/OficinaGestion/departamentos.js

export const departamentos = {
  AMBATO: "Ambato",
  ANCASTI: "Ancasti",
  ANDALGALA: "Andalgalá",
  ANTOFAGASTA: "Antofagasta de la Sierra",
  BELEN: "Belén",
  CAPAYAN: "Capayán",
  CAPITAL: "Capital",
  EL_ALTO: "El Alto",
  FRAY: "Fray Mamerto Esquiú",
  LA_PAZ: "La Paz",
  PACLIN: "Paclín",
  POMAN: "Pomán",
  SANTA_MARIA: "Santa María",
  SANTA_ROSA: "Santa Rosa",
  TINOGASTA: "Tinogasta",
  VALLE_VIEJO: "Valle Viejo",
};

export const departamentosOptions = Object.entries(departamentos).map(
  ([value, label]) => ({
    value,
    label,
  })
);

export const departamentosValues = Object.keys(departamentos);