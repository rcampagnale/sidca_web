import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";

import { db } from "../../firebase/firebase-config";
import styles from "./DispositivosBloqueados.module.css";

const normalizarDni = (value) => String(value || "").replace(/\D/g, "");
const texto = (value) => String(value || "").trim();
const nombrePersona = (data = {}) =>
  texto(data.apellidoNombre || [data.apellido, data.nombre].filter(Boolean).join(", ") || data.afiliadoIntento) ||
  "Sin nombre registrado";

const aFecha = (value) =>
  value?.toDate?.() ||
  (value?.seconds ? new Date(value.seconds * 1000) : value ? new Date(value) : null);

const fechaHora = (value) => {
  const date = aFecha(value);
  if (!date || Number.isNaN(date.getTime())) return "Sin fecha registrada";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
};

const fechaNumero = (value) => {
  const date = aFecha(value);
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

const modeloDispositivo = (data = {}) =>
  texto(
    data.dispositivoModeloIntento || data.dispositivoModelo ||
    data.dispositivoCodigoModelo || data.dispositivoPlataformaIntento ||
    data.dispositivoPlataforma
  ) || "Modelo no informado";

const motivoLabel = (motivo) =>
  motivo === "dispositivo_asociado_a_otro_dni"
    ? "Dispositivo autorizado para otro afiliado"
    : motivo === "dni_asociado_a_otro_dispositivo"
    ? "DNI vinculado a otro dispositivo"
    : texto(motivo) || "Intento rechazado";

const DispositivosBloqueados = () => {
  const [vinculados, setVinculados] = useState([]);
  const [bloqueados, setBloqueados] = useState([]);
  const [reinicios, setReinicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [cursoFiltro, setCursoFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [reiniciando, setReiniciando] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usuariosSnap, nuevosSnap, bloqueosSnap, reiniciosSnap] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "nuevoAfiliado")),
        getDocs(collection(db, "asistencia_intentos_bloqueados")),
        getDocs(collection(db, "asistencia_reinicios_dispositivo")),
      ]);

      const reiniciosItems = reiniciosSnap.docs.map((documento) => ({
        id: documento.id,
        ...(documento.data() || {}),
      }));
      const reinicioPorBloqueo = new Map(
        reiniciosItems
          .filter((item) => item.bloqueoOrigenId)
          .map((item) => [item.bloqueoOrigenId, item])
      );

      const personas = new Map();
      [...usuariosSnap.docs, ...nuevosSnap.docs].forEach((documento) => {
        const data = documento.data() || {};
        const dni = normalizarDni(data.dni || documento.id);
        const deviceId = texto(data.dispositivoAsistenciaId);
        if (!dni || !deviceId) return;
        const anterior = personas.get(dni) || {};
        personas.set(dni, {
          ...anterior,
          ...data,
          dni,
          nombre: nombrePersona(data) !== "Sin nombre registrado" ? nombrePersona(data) : anterior.nombre,
          dispositivoAsistenciaId: deviceId,
        });
      });

      const dispositivosPorId = new Map();
      personas.forEach((persona) => dispositivosPorId.set(persona.dispositivoAsistenciaId, persona));

      const intentos = bloqueosSnap.docs
        .map((documento) => {
          const data = documento.data() || {};
          const titular = dispositivosPorId.get(texto(data.deviceId));
          return {
            id: documento.id,
            ...data,
            dni: normalizarDni(data.dniIntento),
            nombre: texto(data.afiliadoIntento) || "Sin nombre registrado",
            modelo: modeloDispositivo({ ...titular, ...data }),
            titularNombre: texto(data.afiliadoTitular) || titular?.nombre || nombrePersona(titular),
            titularDni: normalizarDni(data.dniTitular || titular?.dni),
            fechaBloqueo: data.creadoEn,
            reinicio: reinicioPorBloqueo.get(documento.id) || null,
          };
        })
        .sort((a, b) => fechaNumero(b.fechaBloqueo) - fechaNumero(a.fechaBloqueo));

      setVinculados(Array.from(personas.values()));
      setBloqueados(intentos);
      setReinicios(reiniciosItems);
    } catch (err) {
      console.error("[DispositivosBloqueados]", err);
      setError("No se pudo cargar la información de dispositivos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const dnisConBloqueos = useMemo(
    () => new Set(bloqueados.map((item) => item.dni).filter(Boolean)),
    [bloqueados]
  );
  const vinculadosSinProblemas = useMemo(
    () => vinculados.filter((item) => !item.dispositivoBloqueado && !dnisConBloqueos.has(item.dni)),
    [dnisConBloqueos, vinculados]
  );
  const ultimosBloqueos = useMemo(() => {
    const porUsuario = new Map();
    bloqueados.forEach((item) => {
      const cursoKey = item.cursoId || texto(item.cursoTitulo).toLowerCase() || "sin-curso";
      const key = `${item.dni || item.deviceId || item.id}|${cursoKey}`;
      if (!porUsuario.has(key)) {
        const intentosCurso = bloqueados.filter(
          (bloqueo) =>
            bloqueo.dni === item.dni &&
            (bloqueo.cursoId || texto(bloqueo.cursoTitulo).toLowerCase() || "sin-curso") === cursoKey
        ).length;
        porUsuario.set(key, { ...item, intentosCurso });
      }
    });
    vinculados.filter((item) => item.dispositivoBloqueado).forEach((item) => {
      const key = `${item.dni}|sin-curso`;
      if (porUsuario.has(key)) return;
      porUsuario.set(key, {
        ...item,
        id: `estado-${item.dni}`,
        modelo: modeloDispositivo(item),
        nombre: item.nombre || nombrePersona(item),
        fechaBloqueo: item.dispositivoUltimaValidacionEn || item.dispositivoVinculadoEn,
        motivo: "dispositivo_bloqueado",
      });
    });
    return Array.from(porUsuario.values());
  }, [bloqueados, vinculados]);

  const intentosPorDni = useMemo(() => {
    const mapa = new Map();
    bloqueados.forEach((item) => mapa.set(item.dni, (mapa.get(item.dni) || 0) + 1));
    return mapa;
  }, [bloqueados]);

  const opcionesCurso = useMemo(() => {
    const mapa = new Map();
    bloqueados.forEach((item) => {
      const value = item.cursoId || texto(item.cursoTitulo).toLowerCase();
      if (value) mapa.set(value, item.cursoTitulo || "Curso sin nombre");
    });
    return [
      { label: "Todos los cursos", value: "" },
      ...Array.from(mapa.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [bloqueados]);

  const obtenerDocumentosDni = async (dni) => {
    const encontrados = new Map();
    await Promise.all(
      ["usuarios", "nuevoAfiliado"].map(async (coleccion) => {
        const directo = await getDoc(doc(db, coleccion, dni));
        if (directo.exists()) encontrados.set(directo.ref.path, directo.ref);
        const valores = [dni, Number(dni)].filter(
          (value, index, array) => value !== "" && Number.isFinite(Number(value)) && array.indexOf(value) === index
        );
        await Promise.all(
          valores.map(async (value) => {
            const snap = await getDocs(query(collection(db, coleccion), where("dni", "==", value)));
            snap.docs.forEach((item) => encontrados.set(item.ref.path, item.ref));
          })
        );
      })
    );
    return Array.from(encontrados.values());
  };

  const reiniciarDispositivo = async (item) => {
    if (!item?.dni || reiniciando) return;
    const confirmar = window.confirm(
      `¿Reiniciar el dispositivo vinculado a ${item.nombre} (DNI ${item.dni})?\n\n` +
        "Los bloqueos anteriores se conservarán para identificar reincidencias."
    );
    if (!confirmar) return;

    setReiniciando(item.id);
    try {
      const referencias = await obtenerDocumentosDni(item.dni);
      if (!referencias.length) throw new Error("No se encontraron registros del afiliado.");
      const dispositivoAnterior = vinculados.find((persona) => persona.dni === item.dni);
      const admin =
        localStorage.getItem("adminEmail") || localStorage.getItem("userEmail") || "admin_web";
      await Promise.all(
        referencias.map((ref) =>
          updateDoc(ref, {
            dispositivoAnteriorId: dispositivoAnterior?.dispositivoAsistenciaId || null,
            dispositivoAnteriorModelo: modeloDispositivo(dispositivoAnterior),
            dispositivoAsistenciaId: null,
            asistenciaDispositivoVinculado: false,
            dispositivoBloqueado: false,
            dispositivoModelo: null,
            dispositivoCodigoModelo: null,
            dispositivoPlataforma: null,
            dispositivoUserAgent: null,
            dispositivoVinculadoEn: null,
            dispositivoVinculadoDesde: null,
            dispositivoUltimaValidacionEn: null,
            dispositivoReiniciadoEn: serverTimestamp(),
            dispositivoReiniciadoPor: admin,
            dispositivoReinicioMotivo: "reinicio_desde_dashboard_bloqueos",
          })
        )
      );
      await addDoc(collection(db, "asistencia_reinicios_dispositivo"), {
        dni: item.dni,
        afiliado: item.nombre,
        cursoId: item.cursoId || null,
        cursoTitulo: item.cursoTitulo || null,
        sessionId: item.sessionId || null,
        bloqueoOrigenId: item.id,
        motivoBloqueo: item.motivo || null,
        cantidadIntentosCurso: item.intentosCurso || 1,
        cantidadIntentosTotal: intentosPorDni.get(item.dni) || 1,
        dispositivoAnteriorId: dispositivoAnterior?.dispositivoAsistenciaId || null,
        dispositivoAnteriorModelo: modeloDispositivo(dispositivoAnterior),
        reiniciadoPor: admin,
        creadoEn: serverTimestamp(),
      });
      await cargar();
    } catch (err) {
      console.error("[DispositivosBloqueados] reinicio:", err);
      window.alert(err?.message || "No se pudo reiniciar el dispositivo.");
    } finally {
      setReiniciando("");
    }
  };

  const filas = useMemo(() => {
    const correctos = vinculadosSinProblemas.map((item) => ({
      ...item, id: `vinculado-${item.dni}`, tipo: "ok", modelo: modeloDispositivo(item), fecha: item.dispositivoVinculadoEn,
    }));
    const problemas = ultimosBloqueos.map((item) => ({
      ...item,
      tipo: "bloqueado",
      fecha: item.fechaBloqueo,
      intentosTotal: intentosPorDni.get(item.dni) || item.intentosCurso || 1,
    }));
    const base = filtro === "ok" ? correctos : filtro === "bloqueados" ? problemas : [...problemas, ...correctos];
    const term = texto(busqueda).toLowerCase();
    const dni = normalizarDni(busqueda);
    return base.filter((item) => {
      const itemCurso = item.cursoId || texto(item.cursoTitulo).toLowerCase();
      if (cursoFiltro && itemCurso !== cursoFiltro) return false;
      if (!term && !dni) return true;
      const contenido = `${item.nombre || ""} ${item.modelo || ""} ${item.deviceId || item.dispositivoAsistenciaId || ""} ${item.titularNombre || ""}`.toLowerCase();
      return (dni && String(item.dni || "").includes(dni)) || (term && contenido.includes(term));
    });
  }, [busqueda, cursoFiltro, filtro, intentosPorDni, ultimosBloqueos, vinculadosSinProblemas]);

  return (
    <section className={styles.root}>
      <div className={styles.header}>
        <div><h2>Dispositivos de asistencia</h2><p>Vinculaciones correctas e intentos rechazados al registrar asistencia presencial.</p></div>
        <Button label="Actualizar" icon="pi pi-refresh" className="p-button-outlined" onClick={cargar} loading={loading} />
      </div>
      <div className={styles.kpis}>
        <article><span>Usuarios con dispositivo</span><strong>{vinculados.length}</strong></article>
        <article className={styles.ok}><span>Sin problemas registrados</span><strong>{vinculadosSinProblemas.length}</strong></article>
        <article className={styles.danger}><span>Usuarios con bloqueos</span><strong>{dnisConBloqueos.size}</strong></article>
        <article><span>Intentos bloqueados / reinicios</span><strong>{bloqueados.length} / {reinicios.length}</strong></article>
      </div>
      <div className={styles.filters}>
        <span className="p-input-icon-left"><i className="pi pi-search" /><InputText value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por afiliado, DNI o dispositivo" /></span>
        <Dropdown value={filtro} onChange={(e) => setFiltro(e.value)} options={[
          { label: "Todos los dispositivos", value: "todos" }, { label: "Sin problemas", value: "ok" }, { label: "Con bloqueos", value: "bloqueados" },
        ]} />
        <Dropdown value={cursoFiltro} onChange={(e) => setCursoFiltro(e.value)} options={opcionesCurso} filter={opcionesCurso.length > 8} />
      </div>
      {loading ? <div className={styles.message}><ProgressSpinner /><span>Cargando dispositivos...</span></div> : error ? <div className={styles.error}>{error}</div> : filas.length === 0 ? <div className={styles.message}>No hay dispositivos que coincidan con el filtro.</div> : (
        <div className={styles.tableWrap}><table><thead><tr><th>Estado</th><th>Afiliado</th><th>Curso</th><th>Dispositivo</th><th>Fecha</th><th>Detalle del bloqueo</th><th>Acción</th></tr></thead><tbody>
          {filas.map((item) => <tr key={item.id}>
            <td><Tag value={item.tipo === "bloqueado" ? "Bloqueado" : "Vinculado"} severity={item.tipo === "bloqueado" ? "danger" : "success"} /></td>
            <td><strong>{item.nombre || nombrePersona(item)}</strong><small>DNI {item.dni || "-"}</small></td>
            <td><strong>{item.cursoTitulo || "Sin curso asociado"}</strong>{item.sessionId && <small>QR/Sesión: {item.sessionId}</small>}{item.tipo === "bloqueado" && <small>{item.intentosCurso || 1} intento(s) en el curso · {item.intentosTotal || 1} total</small>}</td>
            <td><strong>{item.modelo}</strong><small>{item.deviceId || item.dispositivoAsistenciaId || "ID no informado"}</small></td>
            <td>{fechaHora(item.fecha)}</td>
            <td>{item.tipo === "bloqueado" ? <><strong>{motivoLabel(item.motivo)}</strong>{item.titularNombre && <small>Autorizado para {item.titularNombre}{item.titularDni ? ` · DNI ${item.titularDni}` : ""}</small>}</> : <span className={styles.muted}>Sin inconvenientes registrados</span>}</td>
            <td>{item.tipo === "bloqueado" && (item.reinicio ? <><Tag value="Reiniciado" severity="info" /><small>{fechaHora(item.reinicio.creadoEn)}</small></> : <Button label="Reiniciar" icon="pi pi-refresh" className="p-button-sm p-button-warning p-button-outlined" loading={reiniciando === item.id} disabled={Boolean(reiniciando)} onClick={() => reiniciarDispositivo(item)} />)}</td>
          </tr>)}
        </tbody></table></div>
      )}
    </section>
  );
};

export default DispositivosBloqueados;
