import { collection, getDocs } from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import {
  buildVisiblePersonName,
  isValidDni,
  normalizeDni,
  normalizeSearchText,
} from "./titularizacionNormalizer";

export const IDENTITY_FIELDS = [
  "apellido",
  "nombre",
  "nombreCompleto",
  "departamento",
  "contacto",
  "telefono",
  "email",
];

export const AFILIACION_ESTADOS_TITULARIZACION = Object.freeze({
  AFILIADO: "AFILIADO",
  NO_AFILIADO: "NO_AFILIADO",
  NO_VERIFICADO: "NO_VERIFICADO",
});

export const AFILIACION_SOURCES_TITULARIZACION = Object.freeze({
  USUARIOS: "usuarios",
  NUEVO_AFILIADO: "nuevoAfiliado",
  AMBOS: "usuarios+nuevoAfiliado",
  NO_ENCONTRADO: "no_encontrado",
});

const valueOf = (value) => String(value ?? "").trim();
const normalizedValue = (value) => normalizeSearchText(value);

const hasValue = (value) => Boolean(valueOf(value));

const sourceFields = (candidate = {}) =>
  IDENTITY_FIELDS.filter((field) => hasValue(candidate[field]));

const sourceKey = (item = {}) => String(item.sourceType || item.source || "fuente");

const identitySourceEntries = (entries = []) => {
  const bySource = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const key = sourceKey(entry);
    const current = bySource.get(key) || { sourceType: key, fields: [] };
    current.fields = [...new Set([...current.fields, ...(entry.fields || [])])];
    bySource.set(key, current);
  });
  return [...bySource.values()];
};

const conflictKey = (conflict = {}) =>
  `${conflict.field}|${(conflict.values || [])
    .map((item) => `${normalizedValue(item.value)}|${item.source || ""}`)
    .sort()
    .join(";")}`;

const mergeConflict = (conflicts, field, currentValue, currentSource, candidateValue, candidateSource) => {
  const existing = conflicts.find((conflict) => conflict.field === field);
  const values = existing?.values ? [...existing.values] : [];
  [
    { value: currentValue, source: currentSource || "fuente_previa" },
    { value: candidateValue, source: candidateSource },
  ].forEach((item) => {
    if (!hasValue(item.value)) return;
    if (values.some((value) => normalizedValue(value.value) === normalizedValue(item.value) && value.source === item.source)) return;
    values.push(item);
  });

  const next = { field, values };
  if (existing) {
    const index = conflicts.indexOf(existing);
    conflicts[index] = next;
  } else {
    conflicts.push(next);
  }
};

const isMoreComplete = (candidate, current) => {
  const candidateText = valueOf(candidate);
  const currentText = valueOf(current);
  if (!currentText) return true;
  if (candidateText.length !== currentText.length) return candidateText.length > currentText.length;
  return candidateText.split(/\s+/).length > currentText.split(/\s+/).length;
};

/**
 * Merge puro de identidad. Nunca cambia el DNI y nunca reemplaza un valor
 * útil por vacío. Los conflictos se conservan para revisión/detalle.
 */
export const mergePersonIdentity = (person = {}, candidate = {}) => {
  const next = { ...person };
  const candidateSource = sourceKey(candidate);
  const fieldSources = { ...(person.identityFieldSources || {}) };
  const identityConflicts = Array.isArray(person.identityConflicts)
    ? person.identityConflicts.map((conflict) => ({ ...conflict, values: [...(conflict.values || [])] }))
    : [];
  const completionSources = new Set(person.identityCompletionSources || []);
  const visibleFields = sourceFields(candidate);

  visibleFields.forEach((field) => {
    const incoming = valueOf(candidate[field]);
    if (!incoming) return;
    const current = valueOf(next[field]);

    if (!current) {
      next[field] = incoming;
      completionSources.add(candidateSource);
      fieldSources[field] = candidateSource;
      return;
    }

    if (normalizedValue(current) === normalizedValue(incoming)) {
      fieldSources[field] = fieldSources[field] || candidateSource;
      return;
    }

    mergeConflict(
      identityConflicts,
      field,
      current,
      fieldSources[field],
      incoming,
      candidateSource
    );
    if (isMoreComplete(incoming, current)) {
      next[field] = incoming;
      fieldSources[field] = candidateSource;
    }
  });

  const visibleName = buildVisiblePersonName(next);
  if (visibleName) {
    next.nombreCompleto = visibleName;
  } else if (!hasValue(next.nombreCompleto) && hasValue(candidate.nombreCompleto)) {
    next.nombreCompleto = valueOf(candidate.nombreCompleto);
    completionSources.add(candidateSource);
    fieldSources.nombreCompleto = candidateSource;
  }
  if (!hasValue(next.contacto) && hasValue(next.telefono)) {
    next.contacto = next.telefono;
    fieldSources.contacto = fieldSources.contacto || fieldSources.telefono || candidateSource;
  }

  next.identitySources = identitySourceEntries([
    ...(person.identitySources || []),
    { sourceType: candidateSource, fields: visibleFields },
  ]);
  next.identityConflicts = identityConflicts.filter(
    (conflict, index, conflicts) =>
      conflicts.findIndex((item) => conflictKey(item) === conflictKey(conflict)) === index
  );
  next.identityFieldSources = fieldSources;
  next.identityCompletionSources = [...completionSources];
  return next;
};

const firstValue = (data = {}, fields = []) => {
  const field = fields.find((key) => hasValue(data[key]));
  return field ? valueOf(data[field]) : "";
};

export const identityCandidateFromRecord = (record = {}, sourceType = "fuente") => ({
  sourceType,
  dni: normalizeDni(firstValue(record, ["dni", "DNI", "documento", "Documento", "id"])),
  apellido: firstValue(record, ["apellido", "apellidos", "Apellido", "APELLIDO"]),
  nombre: firstValue(record, ["nombre", "nombres", "Nombre", "NOMBRE"]),
  nombreCompleto: firstValue(record, ["nombreCompleto", "apellidoNombre", "nombreCompletoAfiliado"]),
  departamento: firstValue(record, ["departamento", "depto", "dpto", "Departamento"]),
  contacto: firstValue(record, ["contacto", "celular", "telefono", "teléfono", "Telefono"]),
  telefono: firstValue(record, ["telefono", "teléfono", "celular", "Telefono"]),
  email: firstValue(record, ["email", "correo", "correoElectronico", "correo electrónico"]),
});

export const buildAuxiliaryIdentityIndex = ({ usuarios = [], nuevoAfiliado = [] } = {}) => {
  const index = new Map();
  const register = (record, sourceType) => {
    const candidate = identityCandidateFromRecord(record, sourceType);
    if (!isValidDni(candidate.dni)) return;
    const current = index.get(candidate.dni) || { candidates: [], sources: new Set() };
    current.candidates.push(candidate);
    current.sources.add(sourceType);
    index.set(candidate.dni, current);
  };

  usuarios.forEach((record) => register(record, AFILIACION_SOURCES_TITULARIZACION.USUARIOS));
  nuevoAfiliado.forEach((record) => register(record, AFILIACION_SOURCES_TITULARIZACION.NUEVO_AFILIADO));
  return index;
};

export const loadAuxiliaryIdentityIndex = async () => {
  const [usuariosSnapshot, nuevoAfiliadoSnapshot] = await Promise.all([
    getDocs(collection(db, "usuarios")),
    getDocs(collection(db, "nuevoAfiliado")),
  ]);
  const usuarios = usuariosSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const nuevoAfiliado = nuevoAfiliadoSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  return {
    index: buildAuxiliaryIdentityIndex({ usuarios, nuevoAfiliado }),
    leidos: { usuarios: usuarios.length, nuevoAfiliado: nuevoAfiliado.length },
  };
};

export const resolveTitularizacionAffiliation = (index, dni) => {
  const entry = index?.get(normalizeDni(dni));
  if (!entry) {
    return {
      afiliadoSidca: false,
      estadoAfiliacion: AFILIACION_ESTADOS_TITULARIZACION.NO_AFILIADO,
      afiliacionSource: AFILIACION_SOURCES_TITULARIZACION.NO_ENCONTRADO,
    };
  }

  const hasUsuarios = entry.sources.has(AFILIACION_SOURCES_TITULARIZACION.USUARIOS);
  const hasNuevo = entry.sources.has(AFILIACION_SOURCES_TITULARIZACION.NUEVO_AFILIADO);
  return {
    afiliadoSidca: true,
    estadoAfiliacion: AFILIACION_ESTADOS_TITULARIZACION.AFILIADO,
    afiliacionSource: hasUsuarios && hasNuevo
      ? AFILIACION_SOURCES_TITULARIZACION.AMBOS
      : hasUsuarios
        ? AFILIACION_SOURCES_TITULARIZACION.USUARIOS
        : AFILIACION_SOURCES_TITULARIZACION.NUEVO_AFILIADO,
  };
};

const identityCompleteness = (person = {}) => ({
  apellido: hasValue(person.apellido),
  nombre: hasValue(person.nombre),
  completa: hasValue(person.apellido) && hasValue(person.nombre),
});

export const identityDiagnosticsForPeople = (people = []) => {
  const diagnostics = {
    total: people.length,
    conApellidoNombre: 0,
    soloApellido: 0,
    soloNombre: 0,
    sinApellidoNombre: 0,
  };
  people.forEach((person) => {
    const completeness = identityCompleteness(person);
    if (completeness.completa) diagnostics.conApellidoNombre += 1;
    else if (completeness.apellido) diagnostics.soloApellido += 1;
    else if (completeness.nombre) diagnostics.soloNombre += 1;
    else diagnostics.sinApellidoNombre += 1;
  });
  return diagnostics;
};

export const enrichTitularizacionPeople = (
  people = [],
  { auxiliaryIndex = new Map(), verificationCompleted = true } = {}
) => {
  const canonicalPeople = people.filter((person) => isValidDni(person.dni));
  const before = identityDiagnosticsForPeople(canonicalPeople);
  const recoveredBySource = {};
  const enriched = people.map((person) => {
    let next = { ...person };
    const entry = auxiliaryIndex.get(normalizeDni(person.dni));
    (entry?.candidates || []).forEach((candidate) => {
      const beforeCompleteness = identityCompleteness(next);
      next = mergePersonIdentity(next, candidate);
      const afterCompleteness = identityCompleteness(next);
      if (!beforeCompleteness.completa && afterCompleteness.completa) {
        recoveredBySource[candidate.sourceType] = (recoveredBySource[candidate.sourceType] || 0) + 1;
      }
    });

    const affiliation = verificationCompleted && isValidDni(person.dni)
      ? resolveTitularizacionAffiliation(auxiliaryIndex, person.dni)
      : {
          afiliadoSidca: null,
          estadoAfiliacion: AFILIACION_ESTADOS_TITULARIZACION.NO_VERIFICADO,
          afiliacionSource: null,
        };

    return {
      ...next,
      participaTitularizacion: true,
      ...affiliation,
      nombreCompleto: buildVisiblePersonName(next),
      searchable: normalizeSearchText(
        [next.dni, next.apellido, next.nombre, next.nombreCompleto].filter(Boolean).join(" ")
      ),
    };
  });

  const enrichedCanonicalPeople = enriched.filter((person) => isValidDni(person.dni));
  const after = identityDiagnosticsForPeople(enrichedCanonicalPeople);
  const afiliadosSidca = enrichedCanonicalPeople.filter((person) => person.afiliadoSidca === true).length;
  const noAfiliadosSidca = enrichedCanonicalPeople.filter((person) => person.afiliadoSidca === false).length;

  return {
    people: enriched,
    diagnostics: {
      before,
      after,
      recoveredBySource,
      afiliadosSidca,
      noAfiliadosSidca,
      identityConflicts: enrichedCanonicalPeople.reduce(
        (total, person) => total + (person.identityConflicts || []).length,
        0
      ),
      cantidadAntes: canonicalPeople.length,
      cantidadDespues: enrichedCanonicalPeople.length,
    },
  };
};
