const obtenerIdCampo = (campo) => String(campo?.id || "").trim();

export const crearCampoId = () => {
  const cryptoDisponible =
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function";

  if (cryptoDisponible) {
    return `campo_${window.crypto.randomUUID()}`;
  }

  return `campo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const crearCampoNuevo = (campoInicial = {}) => ({
  ...campoInicial,
  id: crearCampoId(),
});

export const normalizarIdsCampos = (campos = []) => {
  const idsUsados = new Set();

  return campos.map((campo) => {
    const idExistente = obtenerIdCampo(campo);

    if (idExistente && !idsUsados.has(idExistente)) {
      idsUsados.add(idExistente);
      return {
        ...campo,
        id: idExistente,
      };
    }

    let nuevoId = crearCampoId();

    while (idsUsados.has(nuevoId)) {
      nuevoId = crearCampoId();
    }

    idsUsados.add(nuevoId);

    return {
      ...campo,
      id: nuevoId,
    };
  });
};

export const tienenIdsCamposDuplicados = (campos = []) => {
  const ids = campos.map(obtenerIdCampo);

  return ids.some((id) => !id) || new Set(ids).size !== ids.length;
};
