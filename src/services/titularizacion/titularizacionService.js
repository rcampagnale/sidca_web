import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import {
  buildTitularizacionMetrics,
  countMappedConcepts,
  createFieldAdapter,
  groupResponsesByPerson,
  normalizeSearchText,
} from "./titularizacionNormalizer";

export const TITULARIZACION_FORMULARIOS_COLLECTION = "oficina_gestion_formularios";
export const TITULARIZACION_RESPUESTAS_COLLECTION = "oficina_gestion_respuestas";

const formSearchText = (formulario = {}) =>
  normalizeSearchText(
    [
      formulario.titulo,
      formulario.descripcion,
      formulario.codigoFormulario,
      formulario.formularioCodigo,
      formulario.formularioNumero,
    ]
      .filter(Boolean)
      .join(" ")
  );

const scoreForm = (formulario = {}) => {
  const searchable = formSearchText(formulario);
  const adapter = createFieldAdapter(formulario);
  const grouped =
    formulario.tipoFormulario === "consulta_excel_agrupada" ||
    formulario.tipoRespuesta === "excel_agrupada" ||
    formulario.configuracionExcel?.habilitado;

  if (!searchable.includes("titularizacion")) return -1;

  let score = 100;
  if (grouped) score += 40;
  score += countMappedConcepts(formulario) * 10;
  if (adapter.dni) score += 10;
  if (formulario.configuracionExcel?.columnaAgrupacion) score += 10;

  return score;
};

export const seleccionarFormularioTitularizacion = (formularios = []) =>
  formularios
    .map((formulario) => ({ formulario, score: scoreForm(formulario) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.formulario || null;

const cargarRespuestasPorFormulario = async (formularioId) => {
  const consultas = [
    ["formularioId", formularioId],
    ["formularioCodigo", formularioId],
    ["formularioNumero", formularioId],
  ];
  const respuestasMap = new Map();

  for (const [campo, valor] of consultas) {
    const snapshot = await getDocs(
      query(collection(db, TITULARIZACION_RESPUESTAS_COLLECTION), where(campo, "==", valor))
    );

    snapshot.docs.forEach((docSnap) => {
      respuestasMap.set(docSnap.id, {
        ...docSnap.data(),
        id: docSnap.id,
      });
    });
  }

  return Array.from(respuestasMap.values());
};

export const loadTitularizacionData = async () => {
  const formulariosSnapshot = await getDocs(
    query(collection(db, TITULARIZACION_FORMULARIOS_COLLECTION))
  );
  const formularios = formulariosSnapshot.docs.map((docSnap) => ({
    ...docSnap.data(),
    id: docSnap.id,
  }));
  const formulario = seleccionarFormularioTitularizacion(formularios);

  if (!formulario) {
    throw new Error("No se encontró un formulario de Titularización con metadatos compatibles.");
  }

  const respuestas = await cargarRespuestasPorFormulario(formulario.id);
  const personas = groupResponsesByPerson(respuestas, formulario);

  return {
    formulario,
    formulariosRelacionados: formularios.filter((item) => scoreForm(item) >= 0),
    respuestas,
    personas,
    metrics: buildTitularizacionMetrics(personas),
  };
};

