// src/components/dashboard/PadronDashboardSection.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "primereact/button";
import { FileUpload } from "primereact/fileupload";
import { Toast } from "primereact/toast";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Dialog } from "primereact/dialog";
import { ProgressBar } from "primereact/progressbar";
import { ProgressSpinner } from "primereact/progressspinner";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ExcelRenderer } from "react-excel-renderer";
import exportFromJSON from "export-from-json";

import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";
import padronStyles from "./PadronDashboardSection.module.css";

/* =========================================================
   Sugerencias conocidas para detectar reparticiones
   ========================================================= */

const SISTEMAS_PADRON = [
  {
    label: "Provincia",
    value: "provincia",
  },
  {
    label: "Sistema Educativo Municipal Capital",
    value: "municipal_capital",
  },
  {
    label: "Sistema Educativo Fray Mamerto Esquiú",
    value: "fray_mamerto_esquiu",
  },
  {
    label: "Juan Pablo",
    value: "juan_pablo",
  },
];

const getSistemaLabel = (value) => {
  const found = SISTEMAS_PADRON.find((s) => s.value === value);
  return found?.label || value || "Sin sistema";
};

const detectReparticionFromFile = (fileName) => {
  const normalized = normalizeText(
    String(fileName || "").replace(/\.(xlsx?|xls)$/i, "")
  );

  const rules = [
    {
      patterns: ["provincia", "provincial"],
      label: "Provincia",
      confidence: 96,
      reason: "Se detectó una referencia provincial en el nombre del archivo.",
    },
    {
      patterns: ["municipal capital", "municipalidad capital", "capital"],
      label: "Sistema Educativo Municipal Capital",
      confidence: 90,
      reason: "Se detectó una referencia al sistema municipal de Capital.",
    },
    {
      patterns: ["fray mamerto esquiu", "fray m esquiu", "fme"],
      label: "Sistema Educativo Fray Mamerto Esquiú",
      confidence: 92,
      reason: "Se detectó una referencia a Fray Mamerto Esquiú.",
    },
    {
      patterns: ["juan pablo"],
      label: "Juan Pablo",
      confidence: 94,
      reason: "Se detectó el nombre Juan Pablo en el archivo.",
    },
    {
      patterns: ["salud", "hospital", "sanitario"],
      label: "Ministerio de Salud",
      confidence: 86,
      reason: "Se detectó una referencia al área de Salud.",
    },
  ];

  const match = rules.find((rule) =>
    rule.patterns.some((pattern) => normalized.includes(pattern))
  );

  if (match) return match;

  return {
    label: "",
    confidence: 30,
    reason: "No se pudo inferir la repartición desde el nombre del archivo.",
  };
};

/* =========================================================
   Helpers generales
   ========================================================= */

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const createSistemaValue = (label) =>
  normalizeText(label).replace(/\s+/g, "_") || "sin_reparticion";

const normalizeDni = (dniRaw) => {
  const digits = String(dniRaw ?? "").replace(/[^\d]/g, "");

  if (!digits) return "";

  if (digits.length === 11 && /^(20|23|24|27|30|33|34)/.test(digits)) {
    return digits.slice(2, 10);
  }

  return digits.slice(0, 12);
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const str = String(value ?? "").trim();
    if (str) return str;
  }

  return "";
};

const normalizarEstadoCurso = (value) => normalizeText(value);

const esCursoAprobado = (curso = {}) => {
  const valores = [
    curso.aprobo,
    curso.aprobado,
    curso.aprobada,
    curso.aprobacion,
    curso.estadoAprobacion,
    curso.estado,
    curso.condicion,
    curso.resultado,
    curso.status,
    curso.finalizado,
    curso.finalizada,
  ];

  return valores.some((value) => {
    if (value === true || value === 1) return true;
    return [
      "true",
      "si",
      "aprobado",
      "aprobada",
      "aprobo",
      "aprobado a",
      "terminado",
      "terminada",
      "finalizado",
      "finalizada",
    ].includes(normalizarEstadoCurso(value));
  });
};

const formatearFechaHoraRegistro = (value) => {
  const fecha =
    value?.toDate?.() ||
    (value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null);

  if (!fecha || Number.isNaN(fecha.getTime())) return "";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
};

const obtenerRegistroHistorico = (data = {}) => {
  const candidatos = [
    ["createdAt", data.createdAt],
    ["fechaServer", data.fechaServer],
    ["fechaRegistro", data.fechaRegistro],
    ["registradoEn", data.registradoEn],
    ["fechaAlta", data.fechaAlta],
    ["timestamp", data.timestamp],
  ];

  for (const [campo, value] of candidatos) {
    const texto = formatearFechaHoraRegistro(value);
    if (texto) return { texto, campo };
  }

  const fechaFormateada = formatearFechaHoraRegistro(data.fecha);
  const horaTexto = String(data.hora || "").trim();
  if (fechaFormateada) {
    return {
      texto: fechaFormateada,
      campo: "fecha",
    };
  }

  const fechaTexto = String(data.fecha || "").trim();
  if (fechaTexto) {
    return {
      texto: [fechaTexto, horaTexto].filter(Boolean).join(" "),
      campo: horaTexto ? "fecha + hora" : "fecha",
    };
  }

  return { texto: "", campo: "" };
};

const formatSiNo = (value) => {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return "—";
};

/* =========================================================
   Detección de columnas del Excel
   ========================================================= */

const FIELD_ALIASES = {
  dni: [
    "dni",
    "documento",
    "nro documento",
    "numero documento",
    "numero de documento",
    "n de documento",
    "n documento",
    "documento nacional de identidad",
    "cuil",
    "cuit",
  ],
  apellido: ["apellido", "apellidos"],
  nombre: ["nombre", "nombres"],
  apellidoNombre: [
    "apellido y nombre",
    "apellidos y nombres",
    "nombre y apellido",
    "docente",
    "afiliado",
    "persona",
  ],
  departamento: ["departamento", "depto", "localidad departamento"],
  establecimiento: [
    "establecimiento",
    "establecimientos",
    "escuela",
    "institucion",
    "institucion educativa",
    "lugar de trabajo",
  ],
  situacion: [
    "situacion",
    "situacion afiliado",
    "estado",
    "estado afiliacion",
    "condicion",
  ],
};

const detectHeader = (rows) => {
  const maxRowsToCheck = Math.min(rows.length, 10);

  for (let rowIndex = 0; rowIndex < maxRowsToCheck; rowIndex++) {
    const row = rows[rowIndex] || [];
    const fieldMap = {};

    row.forEach((cell, colIndex) => {
      const header = normalizeText(cell);
      if (!header) return;

      Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
        if (fieldMap[field] !== undefined) return;

        if (aliases.includes(header)) {
          fieldMap[field] = colIndex;
        }
      });
    });

    if (fieldMap.dni !== undefined) {
      return {
        headerIndex: rowIndex,
        fieldMap,
      };
    }
  }

  return null;
};

const getCell = (row, index) => {
  if (index === undefined || index === null) return "";
  return row?.[index] ?? "";
};

const parsePadronRows = ({ rows, fileName, sistema, sistemaLabel }) => {
  const detected = detectHeader(rows);
  const resolvedSistemaLabel =
    String(sistemaLabel || "").trim() || getSistemaLabel(sistema);

  if (!detected) {
    throw new Error(
      'No se encontró una columna "DNI" en el Excel. Verificá que el encabezado tenga DNI, Documento o CUIL.'
    );
  }

  const { headerIndex, fieldMap } = detected;

  const padronByDni = new Map();
  const duplicados = [];
  const omitidos = [];

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];

    if (!row || row.every((cell) => String(cell ?? "").trim() === "")) {
      continue;
    }

    const rawDni = getCell(row, fieldMap.dni);
    const dni = normalizeDni(rawDni);

    if (!dni) {
      omitidos.push({
        fila: i + 1,
        motivo: "DNI vacío o inválido",
      });
      continue;
    }

    const record = {
      dni,
      apellido: String(getCell(row, fieldMap.apellido) ?? "").trim(),
      nombre: String(getCell(row, fieldMap.nombre) ?? "").trim(),
      apellidoNombre: String(
        getCell(row, fieldMap.apellidoNombre) ?? ""
      ).trim(),
      departamento: String(
        getCell(row, fieldMap.departamento) ?? ""
      ).trim(),
      establecimiento: String(
        getCell(row, fieldMap.establecimiento) ?? ""
      ).trim(),
      situacion: String(getCell(row, fieldMap.situacion) ?? "").trim(),
      filaExcel: i + 1,
      archivo: fileName || "",
      sistema,
      sistemaLabel: resolvedSistemaLabel,
    };

    if (padronByDni.has(dni)) {
      duplicados.push({
        dni,
        fila: i + 1,
        sistema,
        sistemaLabel: resolvedSistemaLabel,
        archivo: fileName || "",
      });

      const previous = padronByDni.get(dni);

      padronByDni.set(dni, {
        ...previous,
        apellido: firstNonEmpty(previous.apellido, record.apellido),
        nombre: firstNonEmpty(previous.nombre, record.nombre),
        apellidoNombre: firstNonEmpty(
          previous.apellidoNombre,
          record.apellidoNombre
        ),
        departamento: firstNonEmpty(
          previous.departamento,
          record.departamento
        ),
        establecimiento: firstNonEmpty(
          previous.establecimiento,
          record.establecimiento
        ),
        situacion: firstNonEmpty(previous.situacion, record.situacion),
      });

      continue;
    }

    padronByDni.set(dni, record);
  }

  return {
    sistema,
    sistemaLabel: resolvedSistemaLabel,
    fileName,
    padronByDni,
    padronRows: Array.from(padronByDni.values()),
    meta: {
      sistema,
      sistemaLabel: resolvedSistemaLabel,
      fileName,
      headerIndex,
      totalFilasExcel: rows.length,
      totalPadron: padronByDni.size,
      duplicados,
      omitidos,
    },
  };
};

const assignReparticionToParsed = (parsed, reparticion) => {
  const sistemaLabel = String(reparticion || "").trim();
  const sistema = createSistemaValue(sistemaLabel);

  return {
    ...parsed,
    sistema,
    sistemaLabel,
    padronRows: parsed.padronRows.map((row) => ({
      ...row,
      sistema,
      sistemaLabel,
    })),
    meta: {
      ...parsed.meta,
      sistema,
      sistemaLabel,
      duplicados: (parsed.meta?.duplicados || []).map((row) => ({
        ...row,
        sistema,
        sistemaLabel,
      })),
    },
  };
};

const renderExcelFile = (fileObj) =>
  new Promise((resolve, reject) => {
    ExcelRenderer(fileObj, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });

/* =========================================================
   Consolidación multisistema
   ========================================================= */

const buildPadronConsolidado = (padronesBySistema) => {
  const consolidadoByDni = new Map();
  const duplicadosInternos = [];

  Object.values(padronesBySistema || {}).forEach((parsed) => {
    if (!parsed) return;

    duplicadosInternos.push(...(parsed.meta?.duplicados || []));
    const sistema = parsed.sistema;
    const sistemaLabel = parsed.sistemaLabel || getSistemaLabel(sistema);

    parsed.padronRows.forEach((row) => {
      const existing =
        consolidadoByDni.get(row.dni) || {
          dni: row.dni,
          apellido: "",
          nombre: "",
          apellidoNombre: "",
          departamento: "",
          establecimiento: "",
          situacion: "",
          sistemasPadron: [],
          sistemasPadronLabels: [],
          archivosPadron: [],
          filasExcel: [],
          registrosPorSistema: [],
          cantidadSistemasPadron: 0,
        };

      const sistemasPadron = Array.from(
        new Set([...existing.sistemasPadron, sistema])
      );

      const labelsBySistema = new Map(
        existing.sistemasPadron.map((value, index) => [
          value,
          existing.sistemasPadronLabels[index] || getSistemaLabel(value),
        ])
      );
      labelsBySistema.set(sistema, sistemaLabel);
      const sistemasPadronLabels = sistemasPadron.map(
        (value) => labelsBySistema.get(value) || getSistemaLabel(value)
      );

      const archivosPadron = Array.from(
        new Set([...existing.archivosPadron, row.archivo].filter(Boolean))
      );

      consolidadoByDni.set(row.dni, {
        ...existing,
        apellido: firstNonEmpty(existing.apellido, row.apellido),
        nombre: firstNonEmpty(existing.nombre, row.nombre),
        apellidoNombre: firstNonEmpty(
          existing.apellidoNombre,
          row.apellidoNombre
        ),
        departamento: firstNonEmpty(existing.departamento, row.departamento),
        establecimiento: firstNonEmpty(
          existing.establecimiento,
          row.establecimiento
        ),
        situacion: firstNonEmpty(existing.situacion, row.situacion),
        sistemasPadron,
        sistemasPadronLabels,
        cantidadSistemasPadron: sistemasPadron.length,
        archivosPadron,
        filasExcel: [
          ...existing.filasExcel,
          {
            sistema,
            sistemaLabel,
            archivo: row.archivo,
            fila: row.filaExcel,
          },
        ],
        registrosPorSistema: [
          ...existing.registrosPorSistema,
          {
            sistema,
            sistemaLabel,
            archivo: row.archivo,
            filaExcel: row.filaExcel,
          },
        ],
      });
    });
  });

  const padronRows = Array.from(consolidadoByDni.values()).sort((a, b) =>
    String(a.apellidoNombre || a.apellido || "").localeCompare(
      String(b.apellidoNombre || b.apellido || ""),
      "es",
      { sensitivity: "base" }
    )
  );

  const multiplesSistemas = padronRows.filter(
    (row) => row.cantidadSistemasPadron > 1
  );

  return {
    padronByDni: consolidadoByDni,
    padronRows,
    duplicadosInternos,
    multiplesSistemas,
  };
};

/* =========================================================
   Lectura y normalización de Firestore
   ========================================================= */

const getDniFromDoc = (data) =>
  normalizeDni(
    data?.dni ||
      data?.DNI ||
      data?.documento ||
      data?.Documento ||
      data?.cuil ||
      data?.CUIL
  );

const getNombreFromDoc = (data) =>
  firstNonEmpty(data?.nombre, data?.Nombre, data?.nombres);

const getApellidoFromDoc = (data) =>
  firstNonEmpty(data?.apellido, data?.Apellido, data?.apellidos);

const getDepartamentoFromDoc = (data) =>
  firstNonEmpty(data?.departamento, data?.departamentoLaboral);

const getEstablecimientoFromDoc = (data) =>
  firstNonEmpty(
    data?.establecimientos,
    data?.establecimiento,
    data?.escuela,
    data?.institucion
  );

const buildAppRecords = (usuariosSnap, nuevoSnap) => {
  const appByDni = new Map();

  const addDoc = (docSnap, collectionName) => {
    const data = docSnap.data() || {};
    const dni = getDniFromDoc(data);

    if (!dni) return;

    const existing =
      appByDni.get(dni) || {
        dni,
        nombre: "",
        apellido: "",
        departamento: "",
        establecimiento: "",
        email: "",
        celular: "",
        nroAfiliacion: "",
        activo: true,
        adherente: false,
        estadoPadron: "",
        posibleDesafiliado: false,
        fechaUltimaComparacionPadron: "",
        sistemasPadron: [],
        sistemasPadronLabels: [],
        cantidadSistemasPadron: 0,
        fechaRegistroApp: "",
        fuenteFechaRegistroApp: "",
        cursosAprobados: [],
        docs: [],
        sources: [],
      };

    const preferThisSource = collectionName === "usuarios";
    const registroHistorico = obtenerRegistroHistorico(data);

    const next = {
      ...existing,

      nombre: preferThisSource
        ? firstNonEmpty(getNombreFromDoc(data), existing.nombre)
        : firstNonEmpty(existing.nombre, getNombreFromDoc(data)),

      apellido: preferThisSource
        ? firstNonEmpty(getApellidoFromDoc(data), existing.apellido)
        : firstNonEmpty(existing.apellido, getApellidoFromDoc(data)),

      departamento: preferThisSource
        ? firstNonEmpty(getDepartamentoFromDoc(data), existing.departamento)
        : firstNonEmpty(existing.departamento, getDepartamentoFromDoc(data)),

      establecimiento: preferThisSource
        ? firstNonEmpty(
            getEstablecimientoFromDoc(data),
            existing.establecimiento
          )
        : firstNonEmpty(
            existing.establecimiento,
            getEstablecimientoFromDoc(data)
          ),

      email: preferThisSource
        ? firstNonEmpty(data?.email, data?.correo, existing.email)
        : firstNonEmpty(existing.email, data?.email, data?.correo),

      celular: preferThisSource
        ? firstNonEmpty(data?.celular, data?.telefono, existing.celular)
        : firstNonEmpty(existing.celular, data?.celular, data?.telefono),

      nroAfiliacion: preferThisSource
        ? firstNonEmpty(data?.nroAfiliacion, existing.nroAfiliacion)
        : firstNonEmpty(existing.nroAfiliacion, data?.nroAfiliacion),

      activo:
        typeof data?.activo === "boolean" ? data.activo : existing.activo,

      adherente:
        typeof data?.adherente === "boolean"
          ? data.adherente
          : existing.adherente,

      estadoPadron: firstNonEmpty(existing.estadoPadron, data?.estadoPadron),

      posibleDesafiliado:
        existing.posibleDesafiliado || data?.posibleDesafiliado === true,

      fechaUltimaComparacionPadron: firstNonEmpty(
        existing.fechaUltimaComparacionPadron,
        data?.fechaUltimaComparacionPadron
      ),

      sistemasPadron: Array.isArray(data?.sistemasPadron)
        ? data.sistemasPadron
        : existing.sistemasPadron,

      sistemasPadronLabels: Array.isArray(data?.sistemasPadronLabels)
        ? data.sistemasPadronLabels
        : existing.sistemasPadronLabels,

      cantidadSistemasPadron:
        typeof data?.cantidadSistemasPadron === "number"
          ? data.cantidadSistemasPadron
          : existing.cantidadSistemasPadron,

      fechaRegistroApp: preferThisSource
        ? firstNonEmpty(registroHistorico.texto, existing.fechaRegistroApp)
        : firstNonEmpty(existing.fechaRegistroApp, registroHistorico.texto),

      fuenteFechaRegistroApp: preferThisSource
        ? firstNonEmpty(
            registroHistorico.campo
              ? `${collectionName}.${registroHistorico.campo}`
              : "",
            existing.fuenteFechaRegistroApp
          )
        : firstNonEmpty(
            existing.fuenteFechaRegistroApp,
            registroHistorico.campo
              ? `${collectionName}.${registroHistorico.campo}`
              : ""
          ),

      docs: [
        ...existing.docs,
        {
          collectionName,
          id: docSnap.id,
        },
      ],

      sources: Array.from(new Set([...existing.sources, collectionName])),
    };

    appByDni.set(dni, next);
  };

  usuariosSnap.forEach((docSnap) => addDoc(docSnap, "usuarios"));
  nuevoSnap.forEach((docSnap) => addDoc(docSnap, "nuevoAfiliado"));

  return Array.from(appByDni.values()).sort((a, b) =>
    String(a.apellido || "").localeCompare(String(b.apellido || ""), "es", {
      sensitivity: "base",
    })
  );
};

/* =========================================================
   Comparación multisistema
   ========================================================= */

const buildComparison = ({ appRecords, padronConsolidado }) => {
  const appByDni = new Map();

  appRecords.forEach((row) => {
    if (row.dni) appByDni.set(row.dni, row);
  });

  const coinciden = [];
  const noEnNingunPadron = [];
  const padronNoEnApp = [];

  appRecords.forEach((appRow) => {
    const padronRow = padronConsolidado.padronByDni.get(appRow.dni);

    if (padronRow) {
      coinciden.push({
        ...appRow,
        estadoComparacion: "EN_APP_Y_PADRON",
        padron: padronRow,
        sistemasPadron: padronRow.sistemasPadron,
        sistemasPadronLabels: padronRow.sistemasPadronLabels,
        cantidadSistemasPadron: padronRow.cantidadSistemasPadron,
      });
    } else {
      noEnNingunPadron.push({
        ...appRow,
        estadoComparacion: "APP_NO_NINGUN_PADRON",
        sistemasPadron: [],
        sistemasPadronLabels: [],
        cantidadSistemasPadron: 0,
      });
    }
  });

  padronConsolidado.padronRows.forEach((padronRow) => {
    if (!appByDni.has(padronRow.dni)) {
      padronNoEnApp.push({
        ...padronRow,
        estadoComparacion: "PADRON_NO_APP",
      });
    }
  });

  return {
    coinciden,
    noEnNingunPadron,
    padronNoEnApp,
    multiplesSistemas: padronConsolidado.multiplesSistemas,
    duplicadosInternos: padronConsolidado.duplicadosInternos,
    totalApp: appRecords.length,
    totalPadron: padronConsolidado.padronRows.length,
  };
};

/* =========================================================
   Componente principal
   ========================================================= */

export default function PadronDashboardSection() {
  const toast = useRef(null);

  const [loadingBase, setLoadingBase] = useState(true);
  const [processingExcel, setProcessingExcel] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markProgress, setMarkProgress] = useState(0);
  const [markDialogVisible, setMarkDialogVisible] = useState(false);

  const [pendingImports, setPendingImports] = useState([]);
  const [appRecords, setAppRecords] = useState([]);
  const [padronesBySistema, setPadronesBySistema] = useState({});
  const [comparisonResult, setComparisonResult] = useState(null);
  const [selectedView, setSelectedView] = useState("noEnNingunPadron");
  const [selectedResultDni, setSelectedResultDni] = useState("");
  const [resultSearch, setResultSearch] = useState("");

  const showSuccess = useCallback((detail) => {
    toast.current?.show({
      severity: "success",
      summary: "Correcto",
      detail,
      life: 3500,
    });
  }, []);

  const showWarn = useCallback((detail) => {
    toast.current?.show({
      severity: "warn",
      summary: "Atención",
      detail,
      life: 4500,
    });
  }, []);

  const showError = useCallback((detail) => {
    toast.current?.show({
      severity: "error",
      summary: "Error",
      detail,
      life: 5000,
    });
  }, []);

  const fetchBaseApp = useCallback(async () => {
    setLoadingBase(true);

    try {
      const [usuariosSnap, nuevoSnap, cursosSnap] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "nuevoAfiliado")),
        getDocs(collectionGroup(db, "cursos")),
      ]);

      const cursosPorUsuario = new Map();

      cursosSnap.docs.forEach((cursoDoc) => {
        const usuarioRef = cursoDoc.ref.parent.parent;
        if (!usuarioRef || usuarioRef.parent.id !== "usuarios") return;

        const data = cursoDoc.data() || {};
        if (!esCursoAprobado(data)) return;

        const curso = {
          id: cursoDoc.id,
          titulo: firstNonEmpty(
            data.titulo,
            data.nombre,
            data.cursoTitulo,
            data.cursoNombre,
            "Curso sin título"
          ),
          estado: firstNonEmpty(
            data.estado,
            data.condicion,
            data.resultado,
            "Aprobado"
          ),
          fechaAprobacion: firstNonEmpty(
            formatearFechaHoraRegistro(data.fechaAprobacion),
            formatearFechaHoraRegistro(data.updatedAt),
            formatearFechaHoraRegistro(data.createdAt)
          ),
        };

        const actuales = cursosPorUsuario.get(usuarioRef.id) || [];
        cursosPorUsuario.set(usuarioRef.id, [...actuales, curso]);
      });

      const records = buildAppRecords(usuariosSnap, nuevoSnap).map((row) => {
        const cursos = row.docs
          .filter((item) => item.collectionName === "usuarios")
          .flatMap((item) => cursosPorUsuario.get(item.id) || []);
        const cursosUnicos = Array.from(
          new Map(
            cursos.map((curso) => [
              normalizeText(curso.titulo) || curso.id,
              curso,
            ])
          ).values()
        ).sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));

        return {
          ...row,
          cursosAprobados: cursosUnicos,
          cantidadCursosAprobados: cursosUnicos.length,
        };
      });
      setAppRecords(records);

      return records;
    } catch (error) {
      console.error("[PadronDashboardSection] Error leyendo base app:", error);
      showError("No se pudo leer la base de afiliados de la app.");
      setAppRecords([]);
      return [];
    } finally {
      setLoadingBase(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchBaseApp();
  }, [fetchBaseApp]);

  const padronConsolidado = useMemo(() => {
    return buildPadronConsolidado(padronesBySistema);
  }, [padronesBySistema]);

  const recalcularComparacion = useCallback(
    async (nextPadronesBySistema) => {
      const baseRecords = appRecords.length ? appRecords : await fetchBaseApp();
      const consolidado = buildPadronConsolidado(nextPadronesBySistema);

      if (!consolidado.padronRows.length) {
        setComparisonResult(null);
        return;
      }

      const result = buildComparison({
        appRecords: baseRecords,
        padronConsolidado: consolidado,
      });

      setComparisonResult(result);
      setSelectedView("noEnNingunPadron");
    },
    [appRecords, fetchBaseApp]
  );

  const handleSelectPadronExcel = async (event) => {
    const files = Array.from(event.files || []);
    if (!files.length) return;

    setProcessingExcel(true);

    try {
      const baseId = Date.now();
      const imported = await Promise.all(
        files.map(async (fileObj, index) => {
          const detection = detectReparticionFromFile(fileObj.name);

          try {
            const response = await renderExcelFile(fileObj);
            const rows = response?.rows || [];

            if (!rows.length) {
              throw new Error("El archivo Excel está vacío.");
            }

            const initialLabel = detection.label || "Repartición pendiente";
            const parsed = parsePadronRows({
              rows,
              fileName: fileObj.name,
              sistema: createSistemaValue(initialLabel),
              sistemaLabel: initialLabel,
            });

            if (!parsed.padronRows.length) {
              throw new Error("No se encontraron DNI válidos en el padrón.");
            }

            return {
              id: `${baseId}-${index}-${fileObj.name}`,
              fileName: fileObj.name,
              fileSize: fileObj.size || 0,
              reparticion: detection.label,
              confidence: detection.confidence,
              reason: detection.reason,
              parsed,
              status: detection.label ? "ready" : "review",
              error: "",
            };
          } catch (error) {
            console.error(
              `[PadronDashboardSection] Error procesando ${fileObj.name}:`,
              error
            );

            return {
              id: `${baseId}-${index}-${fileObj.name}`,
              fileName: fileObj.name,
              fileSize: fileObj.size || 0,
              reparticion: detection.label,
              confidence: detection.confidence,
              reason: detection.reason,
              parsed: null,
              status: "error",
              error: error?.message || "No se pudo procesar el archivo.",
            };
          }
        })
      );

      setPendingImports((current) => [...current, ...imported]);

      const validCount = imported.filter((item) => item.parsed).length;
      const errorCount = imported.length - validCount;

      if (validCount) {
        showSuccess(
          `${validCount} archivo${
            validCount === 1 ? "" : "s"
          } analizado${validCount === 1 ? "" : "s"} correctamente.`
        );
      }

      if (errorCount) {
        showWarn(
          `${errorCount} archivo${
            errorCount === 1 ? "" : "s"
          } requiere${errorCount === 1 ? "" : "n"} revisión.`
        );
      }
    } finally {
      setProcessingExcel(false);

      if (event.options?.clear) {
        event.options.clear();
      }
    }
  };

  const updatePendingReparticion = (id, reparticion) => {
    setPendingImports((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              reparticion,
              status: item.parsed && reparticion.trim() ? "ready" : "review",
            }
          : item
      )
    );
  };

  const removePendingImport = (id) => {
    setPendingImports((current) => current.filter((item) => item.id !== id));
  };

  const clearPendingImports = () => {
    setPendingImports([]);
  };

  const confirmPendingImports = async () => {
    const validImports = pendingImports.filter((item) => item.parsed);
    const incomplete = validImports.filter(
      (item) => !String(item.reparticion || "").trim()
    );

    if (!validImports.length) {
      showWarn("No hay archivos válidos para consolidar.");
      return;
    }

    if (incomplete.length) {
      showWarn("Completá la repartición de todos los archivos válidos.");
      return;
    }

    setProcessingExcel(true);

    try {
      const nextPadrones = { ...padronesBySistema };

      validImports.forEach((item) => {
        nextPadrones[item.id] = assignReparticionToParsed(
          item.parsed,
          item.reparticion
        );
      });

      setPadronesBySistema(nextPadrones);
      await recalcularComparacion(nextPadrones);
      setPendingImports((current) => current.filter((item) => !item.parsed));

      showSuccess(
        `${validImports.length} padrón${
          validImports.length === 1 ? "" : "es"
        } consolidado${validImports.length === 1 ? "" : "s"} correctamente.`
      );
    } catch (error) {
      console.error("[PadronDashboardSection] Error consolidando padrones:", error);
      showError("No se pudieron consolidar los padrones seleccionados.");
    } finally {
      setProcessingExcel(false);
    }
  };

  const limpiarPadrones = () => {
    confirmDialog({
      header: "Limpiar padrones cargados",
      icon: "pi pi-exclamation-triangle",
      message:
        "Se quitarán de esta pantalla todos los padrones cargados. No se modificará Firestore.",
      acceptLabel: "Sí, limpiar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-warning",
      accept: () => {
        setPadronesBySistema({});
        setPendingImports([]);
        setComparisonResult(null);
        setSelectedView("noEnNingunPadron");
        showSuccess("Padrones cargados eliminados de la comparación actual.");
      },
    });
  };

  const kpis = useMemo(() => {
    if (!comparisonResult) {
      return {
        totalApp: appRecords.length,
        totalPadron: padronConsolidado.padronRows.length,
        coinciden: 0,
        noEnNingunPadron: 0,
        padronNoEnApp: 0,
        multiplesSistemas: padronConsolidado.multiplesSistemas.length,
        duplicadosInternos: padronConsolidado.duplicadosInternos.length,
      };
    }

    return {
      totalApp: comparisonResult.totalApp,
      totalPadron: comparisonResult.totalPadron,
      coinciden: comparisonResult.coinciden.length,
      noEnNingunPadron: comparisonResult.noEnNingunPadron.length,
      padronNoEnApp: comparisonResult.padronNoEnApp.length,
      multiplesSistemas: comparisonResult.multiplesSistemas.length,
      duplicadosInternos: comparisonResult.duplicadosInternos.length,
    };
  }, [comparisonResult, appRecords.length, padronConsolidado]);

  const visibleRows = useMemo(() => {
    if (!comparisonResult) return [];

    if (selectedView === "coinciden") {
      return comparisonResult.coinciden;
    }

    if (selectedView === "padronNoEnApp") {
      return comparisonResult.padronNoEnApp;
    }

    if (selectedView === "multiplesSistemas") {
      return comparisonResult.multiplesSistemas;
    }

    if (selectedView === "duplicadosInternos") {
      return comparisonResult.duplicadosInternos;
    }

    if (selectedView === "noPadronConCursos") {
      return comparisonResult.noEnNingunPadron.filter(
        (row) => row.cantidadCursosAprobados > 0
      );
    }

    return comparisonResult.noEnNingunPadron;
  }, [comparisonResult, selectedView]);

  const filteredVisibleRows = useMemo(() => {
    const search = normalizeText(resultSearch);
    if (!search) return visibleRows;

    return visibleRows.filter((row) => {
      const searchable = normalizeText(
        [
          row.dni,
          row.apellido,
          row.nombre,
          row.apellidoNombre,
          row.departamento,
          row.establecimiento,
          ...(row.sistemasPadronLabels || []),
        ].join(" ")
      );

      return searchable.includes(search);
    });
  }, [visibleRows, resultSearch]);

  useEffect(() => {
    const selectedStillVisible = filteredVisibleRows.some(
      (row) => row.dni === selectedResultDni
    );

    if (!selectedStillVisible) {
      setSelectedResultDni(filteredVisibleRows[0]?.dni || "");
    }
  }, [filteredVisibleRows, selectedResultDni]);

  const selectedResultRow =
    filteredVisibleRows.find((row) => row.dni === selectedResultDni) ||
    filteredVisibleRows[0] ||
    null;

  const selectedResultIndex = selectedResultRow
    ? filteredVisibleRows.findIndex((row) => row.dni === selectedResultRow.dni)
    : -1;

  const updateLocalMarkedRows = (
    dniSet,
    estadoPadron,
    sistemasPadron = [],
    sistemasPadronLabels = []
  ) => {
    const nowIso = new Date().toISOString();

    setComparisonResult((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        noEnNingunPadron: prev.noEnNingunPadron.map((row) =>
          dniSet.has(row.dni)
            ? {
                ...row,
                estadoPadron,
                posibleDesafiliado: estadoPadron === "NO_EN_NINGUN_PADRON",
                sistemasPadron,
                sistemasPadronLabels,
                cantidadSistemasPadron: sistemasPadron.length,
                fechaUltimaComparacionPadron: nowIso,
              }
            : row
        ),
        coinciden: prev.coinciden.map((row) =>
          dniSet.has(row.dni)
            ? {
                ...row,
                estadoPadron,
                posibleDesafiliado: false,
                sistemasPadron,
                sistemasPadronLabels,
                cantidadSistemasPadron: sistemasPadron.length,
                fechaUltimaComparacionPadron: nowIso,
              }
            : row
        ),
      };
    });

    setAppRecords((prev) =>
      prev.map((row) =>
        dniSet.has(row.dni)
          ? {
              ...row,
              estadoPadron,
              posibleDesafiliado: estadoPadron === "NO_EN_NINGUN_PADRON",
              sistemasPadron,
              sistemasPadronLabels,
              cantidadSistemasPadron: sistemasPadron.length,
              fechaUltimaComparacionPadron: nowIso,
            }
          : row
      )
    );
  };

  const patchRowsInFirestore = async ({ rowsToPatch, estadoPadron }) => {
    if (!rowsToPatch?.length) {
      showWarn("No hay registros para marcar.");
      return;
    }

    const targets = [];

    rowsToPatch.forEach((row) => {
      if (!row.docs?.length) return;

      row.docs.forEach((target) => {
        targets.push({
          dni: row.dni,
          collectionName: target.collectionName,
          id: target.id,
          sistemasPadron: row.sistemasPadron || [],
          sistemasPadronLabels: row.sistemasPadronLabels || [],
        });
      });
    });

    if (!targets.length) {
      showWarn("No se encontraron documentos válidos para marcar.");
      return;
    }

    setMarking(true);
    setMarkDialogVisible(true);
    setMarkProgress(0);

    const nowIso = new Date().toISOString();

    try {
      let batch = writeBatch(db);
      let operations = 0;
      let processed = 0;

      const affectedDnis = new Set();

      for (const target of targets) {
        const ref = doc(db, target.collectionName, String(target.id));
        const sistemasPadron = target.sistemasPadron || [];
        const sistemasPadronLabels = target.sistemasPadronLabels || [];
        const reparticionesCargadas = Array.from(
          new Set(
            Object.values(padronesBySistema)
              .map((parsed) => parsed?.sistemaLabel)
              .filter(Boolean)
          )
        );

        batch.set(
          ref,
          {
            estadoPadron,
            posibleDesafiliado: estadoPadron === "NO_EN_NINGUN_PADRON",
            sistemasPadron,
            sistemasPadronLabels,
            cantidadSistemasPadron: sistemasPadron.length,
            fechaUltimaComparacionPadron: nowIso,
            origenComparacionPadron: "excel_padron_multisistema",
            sistemasPadronCargados: reparticionesCargadas,
          },
          { merge: true }
        );

        affectedDnis.add(target.dni);
        operations += 1;
        processed += 1;

        if (operations >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          operations = 0;
          setMarkProgress(Math.round((processed / targets.length) * 100));
        }
      }

      if (operations > 0) {
        await batch.commit();
      }

      setMarkProgress(100);

      const firstRow = rowsToPatch[0];
      updateLocalMarkedRows(
        affectedDnis,
        estadoPadron,
        firstRow?.sistemasPadron || [],
        firstRow?.sistemasPadronLabels || []
      );

      showSuccess(`Se actualizaron ${affectedDnis.size} DNI en Firestore.`);
    } catch (error) {
      console.error("[PadronDashboardSection] Error actualizando registros:", error);
      showError("No se pudieron actualizar los registros detectados.");
    } finally {
      setMarking(false);

      setTimeout(() => {
        setMarkDialogVisible(false);
        setMarkProgress(0);
      }, 700);
    }
  };

  const confirmMarkNoPadronAll = () => {
    const rowsToMark = comparisonResult?.noEnNingunPadron || [];

    confirmDialog({
      header: "Marcar posibles desafiliados",
      icon: "pi pi-exclamation-triangle",
      message: (
        <div style={{ display: "grid", gap: 8 }}>
          <div>
            Se marcarán <strong>{rowsToMark.length}</strong> afiliados que están
            en la app pero no aparecen en ninguno de los padrones cargados.
          </div>
          <div>
            Esta acción <strong>no elimina</strong> afiliados. Solo agrega el
            estado <strong>NO_EN_NINGUN_PADRON</strong> para revisarlos después.
          </div>
        </div>
      ),
      acceptLabel: "Sí, marcar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-warning",
      accept: () =>
        patchRowsInFirestore({
          rowsToPatch: rowsToMark,
          estadoPadron: "NO_EN_NINGUN_PADRON",
        }),
    });
  };

  const confirmMarkOneNoPadron = (row) => {
    confirmDialog({
      header: "Marcar afiliado",
      icon: "pi pi-exclamation-triangle",
      message: (
        <div style={{ display: "grid", gap: 8 }}>
          <div>
            ¿Marcar a{" "}
            <strong>
              {row.apellido}, {row.nombre}
            </strong>{" "}
            DNI <strong>{row.dni}</strong> como posible desafiliado?
          </div>
          <div>No se eliminará el registro. Solo se marcará para revisión.</div>
        </div>
      ),
      acceptLabel: "Sí, marcar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-warning",
      accept: () =>
        patchRowsInFirestore({
          rowsToPatch: [row],
          estadoPadron: "NO_EN_NINGUN_PADRON",
        }),
    });
  };

  const buildExportDataset = () => {
    if (!comparisonResult) return [];

    const appNoPadron = comparisonResult.noEnNingunPadron.map((row) => ({
      Estado: "Está en app pero NO está en ningún padrón cargado",
      DNI: row.dni,
      Apellido: row.apellido || "",
      Nombre: row.nombre || "",
      Departamento: row.departamento || "",
      Establecimiento: row.establecimiento || "",
      Email: row.email || "",
      Celular: row.celular || "",
      Origen: row.sources?.join(" + ") || "",
      "Sistemas encontrados": "",
      "Cantidad sistemas": 0,
      "IDs documentos": row.docs
        ?.map((d) => `${d.collectionName}/${d.id}`)
        .join(" | "),
      "Estado padrón guardado": row.estadoPadron || "",
      "Posible desafiliado": formatSiNo(row.posibleDesafiliado),
      "Tiene cursos aprobados": row.cantidadCursosAprobados > 0 ? "Sí" : "No",
      "Cantidad cursos aprobados": row.cantidadCursosAprobados || 0,
      "Cursos aprobados":
        row.cursosAprobados?.map((curso) => curso.titulo).join(" | ") || "Sin cursos",
      "Fecha y hora registro app": row.fechaRegistroApp || "",
      "Fuente fecha registro": row.fuenteFechaRegistroApp || "",
    }));

    const enAmbos = comparisonResult.coinciden.map((row) => ({
      Estado: "Está en app y en al menos un padrón",
      DNI: row.dni,
      Apellido: row.apellido || row.padron?.apellido || "",
      Nombre: row.nombre || row.padron?.nombre || "",
      Departamento: row.departamento || row.padron?.departamento || "",
      Establecimiento:
        row.establecimiento || row.padron?.establecimiento || "",
      Email: row.email || "",
      Celular: row.celular || "",
      Origen: row.sources?.join(" + ") || "",
      "Sistemas encontrados": row.sistemasPadronLabels?.join(" | ") || "",
      "Cantidad sistemas": row.cantidadSistemasPadron || 0,
      "IDs documentos": row.docs
        ?.map((d) => `${d.collectionName}/${d.id}`)
        .join(" | "),
      "Estado padrón guardado": row.estadoPadron || "",
      "Posible desafiliado": formatSiNo(row.posibleDesafiliado),
    }));

    const padronSinApp = comparisonResult.padronNoEnApp.map((row) => ({
      Estado: "Está en padrón pero NO está en app",
      DNI: row.dni,
      Apellido: row.apellido || row.apellidoNombre || "",
      Nombre: row.nombre || "",
      Departamento: row.departamento || "",
      Establecimiento: row.establecimiento || "",
      Situacion: row.situacion || "",
      Origen: "Padrón Excel",
      "Sistemas encontrados": row.sistemasPadronLabels?.join(" | ") || "",
      "Cantidad sistemas": row.cantidadSistemasPadron || 0,
      "Archivos padrón": row.archivosPadron?.join(" | ") || "",
      "Estado padrón guardado": "",
      "Posible desafiliado": "",
    }));

    const multiples = comparisonResult.multiplesSistemas.map((row) => ({
      Estado: "DNI presente en múltiples sistemas",
      DNI: row.dni,
      Apellido: row.apellido || row.apellidoNombre || "",
      Nombre: row.nombre || "",
      Departamento: row.departamento || "",
      Establecimiento: row.establecimiento || "",
      Situacion: row.situacion || "",
      Origen: "Padrón Excel",
      "Sistemas encontrados": row.sistemasPadronLabels?.join(" | ") || "",
      "Cantidad sistemas": row.cantidadSistemasPadron || 0,
      "Archivos padrón": row.archivosPadron?.join(" | ") || "",
      "Estado padrón guardado": "",
      "Posible desafiliado": "",
    }));

    const duplicados = comparisonResult.duplicadosInternos.map((row) => ({
      Estado: "DNI duplicado dentro del mismo padrón",
      DNI: row.dni,
      Apellido: "",
      Nombre: "",
      Departamento: "",
      Establecimiento: "",
      Situacion: "",
      Origen: row.sistemaLabel || "",
      "Sistemas encontrados": row.sistemaLabel || "",
      "Cantidad sistemas": 1,
      Archivo: row.archivo || "",
      "Fila Excel": row.fila || "",
      "Estado padrón guardado": "",
      "Posible desafiliado": "",
    }));

    const datasetsPorVista = {
      noEnNingunPadron: appNoPadron,
      coinciden: enAmbos,
      padronNoEnApp: padronSinApp,
      multiplesSistemas: multiples,
      duplicadosInternos: duplicados,
    };

    return {
      datasetsPorVista,
      todos: [
        ...appNoPadron,
        ...enAmbos,
        ...padronSinApp,
        ...multiples,
        ...duplicados,
      ],
    };
  };

  const handleExportResults = () => {
    if (!comparisonResult) {
      showWarn("Primero tenés que cargar y comparar al menos un padrón.");
      return;
    }

    const data = buildExportDataset().todos;

    if (!data.length) {
      showWarn("No hay datos para exportar.");
      return;
    }

    exportFromJSON({
      data,
      fileName: "comparacion_padron_multisistema_sidca",
      exportType: "xls",
    });

    showSuccess("Resultado exportado correctamente.");
  };

  const handleExportSelectedView = () => {
    if (!comparisonResult) {
      showWarn("Primero tenés que cargar y comparar al menos un padrón.");
      return;
    }

    const exportConfig = {
      noEnNingunPadron: {
        label: "App sin ningún padrón",
        fileName: "app_sin_ningun_padron_sidca",
      },
      coinciden: {
        label: "Coinciden",
        fileName: "app_y_padron_coinciden_sidca",
      },
      padronNoEnApp: {
        label: "Padrón sin app",
        fileName: "padron_sin_app_sidca",
      },
      multiplesSistemas: {
        label: "Múltiples sistemas",
        fileName: "multiples_sistemas_sidca",
      },
      duplicadosInternos: {
        label: "Duplicados internos",
        fileName: "duplicados_internos_sidca",
      },
    };

    const config = exportConfig[selectedView];
    const data = buildExportDataset().datasetsPorVista[selectedView] || [];

    if (!config || !data.length) {
      showWarn("No hay datos en esta opción para exportar.");
      return;
    }

    exportFromJSON({
      data,
      fileName: config.fileName,
      exportType: "xls",
    });

    showSuccess(`${config.label} exportado correctamente.`);
  };

  const nombreBody = (row) => {
    const apellido = String(row.apellido || "").trim();
    const nombre = String(row.nombre || "").trim();
    const apellidoNombre = String(row.apellidoNombre || "").trim();

    if (
      row.estadoComparacion === "PADRON_NO_APP" ||
      selectedView === "multiplesSistemas"
    ) {
      return firstNonEmpty(
        apellidoNombre,
        apellido && nombre ? `${apellido}, ${nombre}` : "",
        apellido,
        nombre
      );
    }

    if (apellido && nombre) return `${apellido}, ${nombre}`;
    if (apellido) return apellido;
    if (nombre) return nombre;
    if (apellidoNombre) return apellidoNombre;

    return "—";
  };

  const duplicadoNombreBody = (row) =>
    row.sistemaLabel || getSistemaLabel(row.sistema);

  const duplicadoArchivoBody = (row) => row.archivo || "—";

  const getRowInitials = (row) => {
    const fullName = nombreBody(row);
    const parts = String(fullName || "")
      .replace(",", " ")
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return "—";
    return parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  };

  const getRowSourceText = (row) => {
    if (row.estadoComparacion === "PADRON_NO_APP") return "Padrón Excel";
    return row.sources?.join(" + ") || "—";
  };

  const getRowStatusLabel = (row) => {
    if (row.estadoComparacion === "APP_NO_NINGUN_PADRON") {
      return "No está en ningún padrón";
    }
    if (row.estadoComparacion === "PADRON_NO_APP") return "No está en app";
    if (row.cantidadSistemasPadron > 1) return "Múltiples sistemas";
    return "En padrón";
  };

  const getRowStatusClass = (row) => {
    if (row.estadoComparacion === "APP_NO_NINGUN_PADRON") {
      return padronStyles.masterStatusDanger;
    }
    if (row.estadoComparacion === "PADRON_NO_APP") {
      return padronStyles.masterStatusWarning;
    }
    if (row.cantidadSistemasPadron > 1) {
      return padronStyles.masterStatusInfo;
    }
    return padronStyles.masterStatusSuccess;
  };

  const selectAdjacentResult = (direction) => {
    if (selectedResultIndex < 0) return;
    const nextIndex = selectedResultIndex + direction;
    const nextRow = filteredVisibleRows[nextIndex];
    if (nextRow) setSelectedResultDni(nextRow.dni);
  };

  const renderTablaGeneral = () => {
    if (!comparisonResult) {
      return (
        <div className={padronStyles.emptyState}>
          Subí uno o más padrones para iniciar la comparación multisistema.
        </div>
      );
    }

    if (visibleRows.length === 0) {
      return (
        <div className={padronStyles.emptyState}>
          No hay registros para mostrar en esta vista.
        </div>
      );
    }

    if (selectedView === "duplicadosInternos") {
      return (
        <div className={padronStyles.tableCard}>
          <div className={padronStyles.tableScroll}>
            <DataTable
              value={visibleRows}
              size="small"
              stripedRows
              paginator
              rows={15}
              rowsPerPageOptions={[15, 30, 50, 100]}
              scrollable
              scrollHeight="520px"
              className={padronStyles.padronDataTableSmall}
              tableStyle={{
                width: "100%",
                tableLayout: "fixed",
              }}
            >
              <Column
                field="dni"
                header="DNI duplicado"
                style={{ width: "18%" }}
              />

              <Column
                header="Sistema"
                body={duplicadoNombreBody}
                style={{ width: "32%" }}
              />

              <Column
                header="Archivo"
                body={duplicadoArchivoBody}
                style={{ width: "35%" }}
              />

              <Column
                field="fila"
                header="Fila Excel"
                style={{ width: "15%" }}
              />
            </DataTable>
          </div>
        </div>
      );
    }

    return (
      <div className={padronStyles.masterDetailLayout}>
        <aside className={padronStyles.masterListPanel}>
          <div className={padronStyles.masterSearch}>
            <i className="pi pi-search" aria-hidden="true" />
            <input
              type="search"
              value={resultSearch}
              onChange={(event) => setResultSearch(event.target.value)}
              placeholder="Buscar por nombre, DNI o departamento..."
            />
          </div>

          <div className={padronStyles.masterListMeta}>
            <span>
              {filteredVisibleRows.length.toLocaleString("es-AR")} resultados
            </span>
            {resultSearch && (
              <button type="button" onClick={() => setResultSearch("")}>
                Limpiar búsqueda
              </button>
            )}
          </div>

          <div className={padronStyles.masterList}>
            {filteredVisibleRows.length ? (
              filteredVisibleRows.map((row) => (
                <button
                  type="button"
                  key={`${selectedView}-${row.dni}-${row.archivo || ""}`}
                  className={`${padronStyles.masterListItem} ${
                    selectedResultRow?.dni === row.dni
                      ? padronStyles.masterListItemActive
                      : ""
                  }`}
                  onClick={() => setSelectedResultDni(row.dni)}
                >
                  <span className={padronStyles.masterAvatar}>
                    {getRowInitials(row)}
                  </span>
                  <span className={padronStyles.masterPerson}>
                    <strong>{nombreBody(row)}</strong>
                    <small>
                      DNI {row.dni} · {row.departamento || "Sin departamento"}
                    </small>
                  </span>
                  <i
                    className={`${padronStyles.masterStatusDot} ${getRowStatusClass(
                      row
                    )}`}
                    title={getRowStatusLabel(row)}
                  />
                </button>
              ))
            ) : (
              <div className={padronStyles.masterListEmpty}>
                No se encontraron registros con esa búsqueda.
              </div>
            )}
          </div>
        </aside>

        <section className={padronStyles.masterDetailPanel}>
          {selectedResultRow ? (
            <>
              <div className={padronStyles.masterDetailHeader}>
                <div className={padronStyles.masterIdentity}>
                  <span className={padronStyles.masterAvatarLarge}>
                    {getRowInitials(selectedResultRow)}
                  </span>
                  <div>
                    <h3>{nombreBody(selectedResultRow)}</h3>
                    <p>
                      DNI {selectedResultRow.dni} ·{" "}
                      {getRowSourceText(selectedResultRow)}
                    </p>
                  </div>
                </div>
                <span
                  className={`${padronStyles.masterStatusBadge} ${getRowStatusClass(
                    selectedResultRow
                  )}`}
                >
                  {getRowStatusLabel(selectedResultRow)}
                </span>
              </div>

              <div className={padronStyles.masterDetailGrid}>
                <article className={padronStyles.masterDetailCard}>
                  <h4>Información del afiliado</h4>
                  <dl>
                    <div>
                      <dt>Departamento</dt>
                      <dd>{selectedResultRow.departamento || "Sin informar"}</dd>
                    </div>
                    <div>
                      <dt>Establecimiento</dt>
                      <dd>
                        {selectedResultRow.establecimiento || "Sin informar"}
                      </dd>
                    </div>
                    <div>
                      <dt>Origen</dt>
                      <dd>{getRowSourceText(selectedResultRow)}</dd>
                    </div>
                    <div>
                      <dt>Contacto</dt>
                      <dd>
                        {firstNonEmpty(
                          selectedResultRow.email,
                          selectedResultRow.celular,
                          "Sin informar"
                        )}
                      </dd>
                    </div>
                  </dl>
                </article>

                <article className={padronStyles.masterDetailCard}>
                  <h4>Resultado de comparación</h4>
                  <dl>
                    <div>
                      <dt>Reparticiones encontradas</dt>
                      <dd>
                        {selectedResultRow.sistemasPadronLabels?.join(", ") ||
                          selectedResultRow.sistemaLabel ||
                          "Ninguna"}
                      </dd>
                    </div>
                    <div>
                      <dt>Cantidad de reparticiones</dt>
                      <dd>{selectedResultRow.cantidadSistemasPadron || 0}</dd>
                    </div>
                    <div>
                      <dt>Posible desafiliado</dt>
                      <dd>
                        {selectedResultRow.estadoComparacion ===
                        "APP_NO_NINGUN_PADRON"
                          ? selectedResultRow.posibleDesafiliado
                            ? "Marcado"
                            : "Pendiente"
                          : "No corresponde"}
                      </dd>
                    </div>
                    <div>
                      <dt>Archivos de padrón</dt>
                      <dd>
                        {selectedResultRow.archivosPadron?.join(", ") || "—"}
                      </dd>
                    </div>
                  </dl>
                </article>

                {selectedResultRow.estadoComparacion ===
                  "APP_NO_NINGUN_PADRON" && (
                  <article
                    className={`${padronStyles.masterDetailCard} ${padronStyles.masterDetailCardWide}`}
                  >
                    <h4>Cursos aprobados y registro histórico</h4>
                    <dl>
                      <div>
                        <dt>Tiene cursos aprobados</dt>
                        <dd>
                          {selectedResultRow.cantidadCursosAprobados > 0
                            ? `Sí (${selectedResultRow.cantidadCursosAprobados})`
                            : "No"}
                        </dd>
                      </div>
                      <div>
                        <dt>Fecha y hora de registro encontrada</dt>
                        <dd>
                          {selectedResultRow.fechaRegistroApp || "No disponible"}
                        </dd>
                      </div>
                      <div>
                        <dt>Campo de origen</dt>
                        <dd>
                          {selectedResultRow.fuenteFechaRegistroApp ||
                            "No se encontró un campo histórico"}
                        </dd>
                      </div>
                    </dl>

                    {selectedResultRow.cursosAprobados?.length > 0 && (
                      <ul className={padronStyles.masterCourseList}>
                        {selectedResultRow.cursosAprobados.map((curso) => (
                          <li key={`${curso.id}-${curso.titulo}`}>
                            <strong>{curso.titulo}</strong>
                            <span>
                              {curso.estado || "Aprobado"}
                              {curso.fechaAprobacion
                                ? ` · ${curso.fechaAprobacion}`
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                )}
              </div>

              <div className={padronStyles.masterDetailActions}>
                <div className={padronStyles.masterNavigation}>
                  <Button
                    label="Anterior"
                    icon="pi pi-chevron-left"
                    className="p-button-sm p-button-outlined"
                    onClick={() => selectAdjacentResult(-1)}
                    disabled={selectedResultIndex <= 0}
                  />
                  <span>
                    {selectedResultIndex + 1} de {filteredVisibleRows.length}
                  </span>
                  <Button
                    label="Siguiente"
                    icon="pi pi-chevron-right"
                    iconPos="right"
                    className="p-button-sm p-button-outlined"
                    onClick={() => selectAdjacentResult(1)}
                    disabled={
                      selectedResultIndex < 0 ||
                      selectedResultIndex >= filteredVisibleRows.length - 1
                    }
                  />
                </div>

                {selectedResultRow.estadoComparacion ===
                  "APP_NO_NINGUN_PADRON" && (
                  <Button
                    label={
                      selectedResultRow.posibleDesafiliado
                        ? "Afiliado marcado"
                        : "Marcar posible desafiliado"
                    }
                    icon={
                      selectedResultRow.posibleDesafiliado
                        ? "pi pi-check"
                        : "pi pi-flag"
                    }
                    className={
                      selectedResultRow.posibleDesafiliado
                        ? "p-button-sm p-button-success"
                        : "p-button-sm p-button-warning"
                    }
                    onClick={() =>
                      confirmMarkOneNoPadron(selectedResultRow)
                    }
                    disabled={marking || selectedResultRow.posibleDesafiliado}
                  />
                )}
              </div>
            </>
          ) : (
            <div className={padronStyles.masterDetailEmpty}>
              Seleccioná un registro para ver su detalle.
            </div>
          )}
        </section>
      </div>
    );
  };

  const sistemasCargados = Object.entries(padronesBySistema);
  const pendingValidCount = pendingImports.filter((item) => item.parsed).length;
  const pendingReviewCount = pendingImports.filter(
    (item) => item.parsed && !String(item.reparticion || "").trim()
  ).length;
  const pendingErrorCount = pendingImports.filter(
    (item) => !item.parsed
  ).length;
  const reparticionesSugeridas = Array.from(
    new Set([
      ...SISTEMAS_PADRON.map((item) => item.label),
      ...Object.values(padronesBySistema)
        .map((parsed) => parsed?.sistemaLabel)
        .filter(Boolean),
      "Ministerio de Salud",
    ])
  );

  return (
    <div className={`${styles.infoAfiliadoRow} ${padronStyles.padronSection}`}>
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className={`${styles.panel} ${padronStyles.mainPanel}`}>
        <header className={padronStyles.header}>
          <div>
            <span className={padronStyles.eyebrow}>Control multisistema</span>
            <h2 className={padronStyles.title}>Padrón actualizado</h2>
            <p className={padronStyles.subtitle}>
              Importá varios Excel, confirmá libremente sus reparticiones y
              consolidalos por DNI antes de comparar.
            </p>
          </div>
          <span className={padronStyles.headerBadge}>
            {sistemasCargados.length} archivos consolidados
          </span>
        </header>

        <div className={`${styles.panelBody} ${padronStyles.padronPanelBody}`}>
          {loadingBase ? (
            <div className={padronStyles.loadingState}>
              <ProgressSpinner
                style={{ width: "42px", height: "42px" }}
                strokeWidth="4"
              />
              <span>Leyendo usuarios y nuevos afiliados...</span>
            </div>
          ) : (
            <div className={padronStyles.content}>
              <div className={padronStyles.infoBox}>
                <i className="pi pi-info-circle" aria-hidden="true" />
                <div>
                  <strong>Comparación segura:</strong> un afiliado solo será
                  considerado <strong>posible desafiliado</strong> si está en la
                  app pero no aparece en ninguno de los padrones consolidados.
                </div>
              </div>

              <section className={padronStyles.importerCard}>
                <div className={padronStyles.importerHeader}>
                  <div>
                    <span className={padronStyles.importerStep}>
                      Importador inteligente
                    </span>
                    <h3>Analizar padrones Excel</h3>
                    <p>
                      La repartición se sugiere desde el nombre del archivo y
                      siempre puede corregirse o escribirse desde cero.
                    </p>
                  </div>
                  <FileUpload
                    name="padrones"
                    mode="basic"
                    accept=".xls,.xlsx"
                    maxFileSize={10_000_000}
                    multiple
                    chooseLabel={
                      processingExcel
                        ? "Analizando archivos..."
                        : "Seleccionar varios Excel"
                    }
                    customUpload
                    uploadHandler={handleSelectPadronExcel}
                    auto
                    disabled={processingExcel || loadingBase}
                    className={padronStyles.uploadButton}
                  />
                </div>

                {pendingImports.length === 0 ? (
                  <div className={padronStyles.dropZone}>
                    <div className={padronStyles.dropIcon}>
                      <i className="pi pi-file-excel" aria-hidden="true" />
                    </div>
                    <strong>Seleccioná todos los padrones de esta revisión</strong>
                    <span>
                      Se admiten varios archivos .xls y .xlsx de reparticiones
                      diferentes.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className={padronStyles.analysisSummary}>
                      <span>
                        <strong>{pendingImports.length}</strong> analizados
                      </span>
                      <span className={padronStyles.summaryReady}>
                        <strong>{pendingValidCount - pendingReviewCount}</strong>{" "}
                        listos
                      </span>
                      <span className={padronStyles.summaryReview}>
                        <strong>{pendingReviewCount}</strong> por revisar
                      </span>
                      <span className={padronStyles.summaryError}>
                        <strong>{pendingErrorCount}</strong> con error
                      </span>
                    </div>

                    <div className={padronStyles.importList}>
                      {pendingImports.map((item) => (
                        <article
                          key={item.id}
                          className={`${padronStyles.importRow} ${
                            item.status === "error"
                              ? padronStyles.importRowError
                              : ""
                          }`}
                        >
                          <div className={padronStyles.fileIdentity}>
                            <div className={padronStyles.excelIcon}>XLS</div>
                            <div>
                              <strong>{item.fileName}</strong>
                              <span>
                                {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                                {item.parsed
                                  ? ` · ${item.parsed.meta.totalPadron.toLocaleString(
                                      "es-AR"
                                    )} DNI`
                                  : ""}
                              </span>
                            </div>
                          </div>

                          <div className={padronStyles.detection}>
                            <div className={padronStyles.confidenceTop}>
                              <span>Detección automática</span>
                              <strong>{item.confidence}%</strong>
                            </div>
                            <div className={padronStyles.confidenceTrack}>
                              <span
                                className={
                                  item.confidence >= 70
                                    ? padronStyles.confidenceGood
                                    : padronStyles.confidenceLow
                                }
                                style={{ width: `${item.confidence}%` }}
                              />
                            </div>
                            <small>{item.error || item.reason}</small>
                          </div>

                          <div className={padronStyles.reparticionField}>
                            <label htmlFor={`reparticion-${item.id}`}>
                              Repartición
                            </label>
                            <input
                              id={`reparticion-${item.id}`}
                              type="text"
                              list="reparticiones-padron"
                              value={item.reparticion}
                              onChange={(event) =>
                                updatePendingReparticion(
                                  item.id,
                                  event.target.value
                                )
                              }
                              placeholder="Escribir repartición..."
                              disabled={!item.parsed || processingExcel}
                            />
                          </div>

                          <div className={padronStyles.importStatus}>
                            <span
                              className={`${padronStyles.statusBadge} ${
                                item.status === "ready"
                                  ? padronStyles.statusReady
                                  : item.status === "error"
                                  ? padronStyles.statusError
                                  : padronStyles.statusReview
                              }`}
                            >
                              {item.status === "ready"
                                ? "Listo"
                                : item.status === "error"
                                ? "Error"
                                : "Revisar"}
                            </span>
                            <Button
                              icon="pi pi-times"
                              className="p-button-rounded p-button-text p-button-danger p-button-sm"
                              onClick={() => removePendingImport(item.id)}
                              disabled={processingExcel}
                              aria-label={`Quitar ${item.fileName}`}
                            />
                          </div>
                        </article>
                      ))}
                    </div>

                    <datalist id="reparticiones-padron">
                      {reparticionesSugeridas.map((label) => (
                        <option key={label} value={label} />
                      ))}
                    </datalist>

                    <div className={padronStyles.importActions}>
                      <span>
                        Confirmá las reparticiones antes de incorporarlas a la
                        comparación.
                      </span>
                      <div>
                        <Button
                          label="Descartar análisis"
                          icon="pi pi-times"
                          className="p-button-sm p-button-outlined"
                          onClick={clearPendingImports}
                          disabled={processingExcel}
                        />
                        <Button
                          label={`Confirmar y consolidar (${pendingValidCount})`}
                          icon="pi pi-check"
                          className="p-button-sm p-button-success"
                          onClick={confirmPendingImports}
                          disabled={
                            processingExcel ||
                            !pendingValidCount ||
                            pendingReviewCount > 0
                          }
                        />
                      </div>
                    </div>
                  </>
                )}
              </section>

              <div className={padronStyles.toolbar}>
                <Button
                  label="Recargar base app"
                  icon="pi pi-refresh"
                  className="p-button-sm p-button-outlined"
                  onClick={fetchBaseApp}
                  disabled={processingExcel || loadingBase}
                />

                <Button
                  label="Exportar comparación"
                  icon="pi pi-download"
                  className="p-button-sm p-button-success"
                  onClick={handleExportResults}
                  disabled={!comparisonResult || processingExcel}
                />

                <Button
                  label="Limpiar padrones"
                  icon="pi pi-trash"
                  className="p-button-sm p-button-outlined p-button-danger"
                  onClick={limpiarPadrones}
                  disabled={!sistemasCargados.length || processingExcel}
                />

                <Button
                  label="Marcar posibles desafiliados"
                  icon="pi pi-flag"
                  className="p-button-sm p-button-warning"
                  onClick={confirmMarkNoPadronAll}
                  disabled={
                    !comparisonResult ||
                    comparisonResult.noEnNingunPadron.length === 0 ||
                    marking
                  }
                />
              </div>

              {sistemasCargados.length > 0 && (
                <div className={padronStyles.loadedBox}>
                  <strong>Padrones cargados:</strong>

                  {sistemasCargados.map(([uploadId, parsed]) => (
                    <div key={uploadId} className={padronStyles.loadedItem}>
                      <strong>{parsed.sistemaLabel}:</strong>{" "}
                      {parsed.meta.fileName} · {parsed.meta.totalPadron} DNI
                      únicos · {parsed.meta.duplicados.length} duplicados
                      internos · {parsed.meta.omitidos.length} filas omitidas
                    </div>
                  ))}
                </div>
              )}

              <div className={padronStyles.kpiGrid}>
                <KpiCard label="Afiliados en app" value={kpis.totalApp} />

                <KpiCard
                  label="DNI únicos en padrones"
                  value={kpis.totalPadron}
                />

                <KpiCard
                  label="Coinciden"
                  value={kpis.coinciden}
                  tone="success"
                />

                <KpiCard
                  label="App sin ningún padrón"
                  value={kpis.noEnNingunPadron}
                  tone="danger"
                />

                <KpiCard
                  label="Padrón sin app"
                  value={kpis.padronNoEnApp}
                  tone="warning"
                />

                <KpiCard
                  label="Múltiples sistemas"
                  value={kpis.multiplesSistemas}
                  tone="info"
                />

                <KpiCard
                  label="Duplicados internos"
                  value={kpis.duplicadosInternos}
                  tone="warning"
                />
              </div>

              {comparisonResult && (
                <div className={padronStyles.viewButtons}>
                  <Button
                    label={`App sin ningún padrón (${comparisonResult.noEnNingunPadron.length})`}
                    icon="pi pi-exclamation-triangle"
                    className={
                      selectedView === "noEnNingunPadron"
                        ? "p-button-danger p-button-sm"
                        : "p-button-outlined p-button-danger p-button-sm"
                    }
                    onClick={() => setSelectedView("noEnNingunPadron")}
                  />

                  <Button
                    label={`Coinciden (${comparisonResult.coinciden.length})`}
                    icon="pi pi-check"
                    className={
                      selectedView === "coinciden"
                        ? "p-button-success p-button-sm"
                        : "p-button-outlined p-button-success p-button-sm"
                    }
                    onClick={() => setSelectedView("coinciden")}
                  />

                  <Button
                    label={`Padrón sin app (${comparisonResult.padronNoEnApp.length})`}
                    icon="pi pi-info-circle"
                    className={
                      selectedView === "padronNoEnApp"
                        ? "p-button-warning p-button-sm"
                        : "p-button-outlined p-button-warning p-button-sm"
                    }
                    onClick={() => setSelectedView("padronNoEnApp")}
                  />

                  <Button
                    label={`Múltiples sistemas (${comparisonResult.multiplesSistemas.length})`}
                    icon="pi pi-sitemap"
                    className={
                      selectedView === "multiplesSistemas"
                        ? "p-button-info p-button-sm"
                        : "p-button-outlined p-button-info p-button-sm"
                    }
                    onClick={() => setSelectedView("multiplesSistemas")}
                  />

                  <Button
                    label={`Duplicados internos (${comparisonResult.duplicadosInternos.length})`}
                    icon="pi pi-copy"
                    className={
                      selectedView === "duplicadosInternos"
                        ? "p-button-warning p-button-sm"
                        : "p-button-outlined p-button-warning p-button-sm"
                    }
                    onClick={() => setSelectedView("duplicadosInternos")}
                  />

                  <Button
                    label="Descargar opción seleccionada"
                    icon="pi pi-download"
                    className="p-button-sm p-button-success"
                    onClick={handleExportSelectedView}
                    disabled={
                      !visibleRows.length ||
                      processingExcel ||
                      selectedView === "noPadronConCursos"
                    }
                  />

                  <Button
                    label={`Sin padrón con cursos (${comparisonResult.noEnNingunPadron.filter(
                      (row) => row.cantidadCursosAprobados > 0
                    ).length})`}
                    icon="pi pi-eye"
                    className={
                      selectedView === "noPadronConCursos"
                        ? "p-button-sm p-button-help"
                        : "p-button-sm p-button-outlined p-button-help"
                    }
                    onClick={() => setSelectedView("noPadronConCursos")}
                    disabled={
                      processingExcel ||
                      !comparisonResult.noEnNingunPadron.some(
                        (row) => row.cantidadCursosAprobados > 0
                      )
                    }
                  />
                </div>
              )}

              {renderTablaGeneral()}
            </div>
          )}
        </div>
      </div>

      <Dialog
        header="Actualizando estado de padrón"
        visible={markDialogVisible}
        modal
        closable={false}
        style={{ width: 460, maxWidth: "95vw" }}
      >
        <div className={padronStyles.progressDialogContent}>
          <div>
            Guardando comparación de padrón en los documentos detectados. No
            cierres esta ventana.
          </div>

          <ProgressBar value={markProgress} />

          <div className={padronStyles.progressSubText}>
            Progreso: {markProgress}%
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/* =========================================================
   KPI Card
   ========================================================= */

function KpiCard({ label, value, tone = "default" }) {
  const toneClass =
    {
      default: padronStyles.kpiDefault,
      success: padronStyles.kpiSuccess,
      danger: padronStyles.kpiDanger,
      warning: padronStyles.kpiWarning,
      info: padronStyles.kpiInfo,
    }[tone] || padronStyles.kpiDefault;

  return (
    <div className={`${padronStyles.kpiCard} ${toneClass}`}>
      <div className={padronStyles.kpiLabel}>{label}</div>
      <div className={padronStyles.kpiValue}>{value}</div>
    </div>
  );
}
