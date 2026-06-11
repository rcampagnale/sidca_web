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
import { Tag } from "primereact/tag";
import { Dropdown } from "primereact/dropdown";
import { ExcelRenderer } from "react-excel-renderer";
import exportFromJSON from "export-from-json";

import { collection, doc, getDocs, writeBatch } from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";
import padronStyles from "./PadronDashboardSection.module.css";

/* =========================================================
   Sistemas educativos / padrones válidos
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

const parsePadronRows = ({ rows, fileName, sistema }) => {
  const detected = detectHeader(rows);

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
      sistemaLabel: getSistemaLabel(sistema),
    };

    if (padronByDni.has(dni)) {
      duplicados.push({
        dni,
        fila: i + 1,
        sistema,
        sistemaLabel: getSistemaLabel(sistema),
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
    sistemaLabel: getSistemaLabel(sistema),
    fileName,
    padronByDni,
    padronRows: Array.from(padronByDni.values()),
    meta: {
      sistema,
      sistemaLabel: getSistemaLabel(sistema),
      fileName,
      headerIndex,
      totalFilasExcel: rows.length,
      totalPadron: padronByDni.size,
      duplicados,
      omitidos,
    },
  };
};

/* =========================================================
   Consolidación multisistema
   ========================================================= */

const buildPadronConsolidado = (padronesBySistema) => {
  const consolidadoByDni = new Map();
  const duplicadosInternos = [];

  Object.entries(padronesBySistema || {}).forEach(([sistema, parsed]) => {
    if (!parsed) return;

    duplicadosInternos.push(...(parsed.meta?.duplicados || []));

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

      const sistemasPadronLabels = sistemasPadron.map(getSistemaLabel);

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
            sistemaLabel: getSistemaLabel(sistema),
            archivo: row.archivo,
            fila: row.filaExcel,
          },
        ],
        registrosPorSistema: [
          ...existing.registrosPorSistema,
          {
            sistema,
            sistemaLabel: getSistemaLabel(sistema),
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
        docs: [],
        sources: [],
      };

    const preferThisSource = collectionName === "usuarios";

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

  const [selectedSistema, setSelectedSistema] = useState("provincia");
  const [appRecords, setAppRecords] = useState([]);
  const [padronesBySistema, setPadronesBySistema] = useState({});
  const [comparisonResult, setComparisonResult] = useState(null);
  const [selectedView, setSelectedView] = useState("noEnNingunPadron");

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
      const [usuariosSnap, nuevoSnap] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "nuevoAfiliado")),
      ]);

      const records = buildAppRecords(usuariosSnap, nuevoSnap);
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

  const handleSelectPadronExcel = (event) => {
    const fileObj = event.files?.[0];

    if (!fileObj) return;

    if (!selectedSistema) {
      showWarn("Primero seleccioná el sistema educativo del padrón.");
      if (event.options?.clear) event.options.clear();
      return;
    }

    setProcessingExcel(true);

    ExcelRenderer(fileObj, async (err, resp) => {
      try {
        if (err) {
          console.error(err);
          showError("No se pudo leer el archivo Excel del padrón.");
          return;
        }

        const rows = resp?.rows || [];

        if (!rows.length) {
          showError("El archivo Excel está vacío.");
          return;
        }

        const parsed = parsePadronRows({
          rows,
          fileName: fileObj.name,
          sistema: selectedSistema,
        });

        if (!parsed.padronRows.length) {
          showError("No se encontraron DNI válidos en el padrón.");
          return;
        }

        const nextPadrones = {
          ...padronesBySistema,
          [selectedSistema]: parsed,
        };

        setPadronesBySistema(nextPadrones);
        await recalcularComparacion(nextPadrones);

        showSuccess(
          `Padrón de ${getSistemaLabel(
            selectedSistema
          )} procesado correctamente.`
        );
      } catch (error) {
        console.error("[PadronDashboardSection] Error procesando padrón:", error);
        showError(error?.message || "No se pudo procesar el padrón.");
      } finally {
        setProcessingExcel(false);

        if (event.options?.clear) {
          event.options.clear();
        }
      }
    });
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

    return comparisonResult.noEnNingunPadron;
  }, [comparisonResult, selectedView]);

  const updateLocalMarkedRows = (dniSet, estadoPadron, sistemasPadron = []) => {
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
                sistemasPadronLabels: sistemasPadron.map(getSistemaLabel),
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
                sistemasPadronLabels: sistemasPadron.map(getSistemaLabel),
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
              sistemasPadronLabels: sistemasPadron.map(getSistemaLabel),
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

        batch.set(
          ref,
          {
            estadoPadron,
            posibleDesafiliado: estadoPadron === "NO_EN_NINGUN_PADRON",
            sistemasPadron,
            sistemasPadronLabels: sistemasPadron.map(getSistemaLabel),
            cantidadSistemasPadron: sistemasPadron.length,
            fechaUltimaComparacionPadron: nowIso,
            origenComparacionPadron: "excel_padron_multisistema",
            sistemasPadronCargados: Object.keys(padronesBySistema),
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
        firstRow?.sistemasPadron || []
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

    return [
      ...appNoPadron,
      ...enAmbos,
      ...padronSinApp,
      ...multiples,
      ...duplicados,
    ];
  };

  const handleExportResults = () => {
    if (!comparisonResult) {
      showWarn("Primero tenés que cargar y comparar al menos un padrón.");
      return;
    }

    const data = buildExportDataset();

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

  const sistemasBody = (row) => {
    const labels = row.sistemasPadronLabels || [];

    if (!labels.length && row.sistemaLabel) {
      return <Tag value={row.sistemaLabel} severity="warning" />;
    }

    if (!labels.length) return "—";

    return (
      <div className={padronStyles.tagWrap}>
        {labels.map((label) => (
          <Tag key={label} value={label} severity="success" />
        ))}
      </div>
    );
  };

  const sourceBody = (row) => {
    if (row.estadoComparacion === "PADRON_NO_APP") {
      return <Tag value="Padrón Excel" severity="warning" />;
    }

    if (row.sources?.length > 1) {
      return (
        <div className={padronStyles.tagWrap}>
          {row.sources.map((source) => (
            <Tag
              key={source}
              value={source}
              severity={source === "usuarios" ? "info" : "contrast"}
            />
          ))}
        </div>
      );
    }

    const source = row.sources?.[0] || "—";

    return (
      <Tag
        value={source}
        severity={source === "usuarios" ? "info" : "contrast"}
      />
    );
  };

  const estadoBody = (row) => {
    if (row.estadoComparacion === "APP_NO_NINGUN_PADRON") {
      return <Tag value="No está en ningún padrón" severity="danger" />;
    }

    if (row.estadoComparacion === "PADRON_NO_APP") {
      return <Tag value="No está en app" severity="warning" />;
    }

    if (row.cantidadSistemasPadron > 1) {
      return <Tag value="Múltiples sistemas" severity="info" />;
    }

    return <Tag value="En padrón" severity="success" />;
  };

  const posibleDesafiliadoBody = (row) => {
    if (row.estadoComparacion !== "APP_NO_NINGUN_PADRON") return "—";

    return row.posibleDesafiliado ? (
      <Tag value="Marcado" severity="danger" />
    ) : (
      <Tag value="Pendiente" severity="warning" />
    );
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

  const actionBody = (row) => {
    if (row.estadoComparacion !== "APP_NO_NINGUN_PADRON") return null;

    return (
      <Button
        label={row.posibleDesafiliado ? "Marcado" : "Marcar"}
        icon={row.posibleDesafiliado ? "pi pi-check" : "pi pi-flag"}
        className={`${padronStyles.actionButton} ${
          row.posibleDesafiliado
            ? "p-button-sm p-button-success"
            : "p-button-sm p-button-warning"
        }`}
        onClick={() => confirmMarkOneNoPadron(row)}
        disabled={marking || row.posibleDesafiliado}
      />
    );
  };

  const duplicadoNombreBody = (row) =>
    row.sistemaLabel || getSistemaLabel(row.sistema);

  const duplicadoArchivoBody = (row) => row.archivo || "—";

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
            scrollHeight="560px"
            dataKey="dni"
            className={padronStyles.padronDataTable}
            tableStyle={{
              width: "100%",
              tableLayout: "fixed",
            }}
          >
            <Column field="dni" header="DNI" style={{ width: "8%" }} />

            <Column
              header="Apellido y Nombre"
              body={(row) => (
                <div className={padronStyles.nameCell}>{nombreBody(row)}</div>
              )}
              style={{ width: "16%" }}
            />

            <Column
              field="departamento"
              header="Departamento"
              body={(row) => (
                <div className={padronStyles.textCell}>
                  {row.departamento || "—"}
                </div>
              )}
              style={{ width: "10%" }}
            />

            <Column
              field="establecimiento"
              header="Establecimiento"
              body={(row) => (
                <div className={padronStyles.textCell}>
                  {row.establecimiento || "—"}
                </div>
              )}
              style={{ width: "15%" }}
            />

            <Column header="Origen" body={sourceBody} style={{ width: "8%" }} />

            <Column
              header="Sistemas encontrados"
              body={(row) => (
                <div className={padronStyles.tagWrap}>
                  {sistemasBody(row)}
                </div>
              )}
              style={{ width: "17%" }}
            />

            <Column
              header="Estado comparación"
              body={estadoBody}
              style={{ width: "12%" }}
            />

            <Column
              header="Posible desafiliado"
              body={posibleDesafiliadoBody}
              style={{ width: "6%" }}
            />

            <Column
              header="Acción"
              body={actionBody}
              style={{ width: "8%" }}
            />
          </DataTable>
        </div>
      </div>
    );
  };

  const sistemasCargados = Object.entries(padronesBySistema);

  return (
    <div className={`${styles.infoAfiliadoRow} ${padronStyles.padronSection}`}>
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          Control de padrón actualizado multisistema
        </div>

        <div className={`${styles.panelBody} ${padronStyles.padronPanelBody}`}>
          {loadingBase ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <ProgressSpinner
                style={{ width: "42px", height: "42px" }}
                strokeWidth="4"
              />
              <div style={{ marginTop: 10, color: "#6b7280" }}>
                Leyendo usuarios y nuevoAfiliado...
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div className={padronStyles.infoBox}>
                <strong>Objetivo:</strong> cargar padrones de distintos sistemas
                educativos y consolidarlos por DNI. Un afiliado solo será
                considerado <strong>posible desafiliado</strong> si está en la app
                pero no aparece en ninguno de los padrones cargados.
              </div>

              <div className={padronStyles.toolbar}>
                <Dropdown
                  value={selectedSistema}
                  options={SISTEMAS_PADRON}
                  onChange={(e) => setSelectedSistema(e.value)}
                  placeholder="Seleccionar sistema"
                  className={padronStyles.systemDropdown}
                  disabled={processingExcel}
                />

                <FileUpload
                  name="padron"
                  mode="basic"
                  accept=".xls,.xlsx"
                  maxFileSize={10_000_000}
                  chooseLabel={
                    processingExcel
                      ? "Procesando padrón..."
                      : "Subir padrón del sistema seleccionado"
                  }
                  customUpload
                  uploadHandler={handleSelectPadronExcel}
                  auto
                  disabled={processingExcel || loadingBase || !selectedSistema}
                  className="p-button-sm p-button-warning"
                />

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

                  {sistemasCargados.map(([sistema, parsed]) => (
                    <div key={sistema} className={padronStyles.loadedItem}>
                      <strong>{getSistemaLabel(sistema)}:</strong>{" "}
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