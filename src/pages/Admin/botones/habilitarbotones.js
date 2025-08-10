import React, { useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebase-config";
import styles from "./habilitarbotones.module.css";

const HabilitarBotones = () => {
  const toast = useRef(null);

  // ===== Pantalla de carga inicial =====
  const [bootLoading, setBootLoading] = useState(true);

  // ===== ASISTENCIA (cod/boton.cargar: 'si'|'no') =====
  const [asistenciaHabilitada, setAsistenciaHabilitada] = useState(null); // null|'si'|'no'
  const [visibleDialogAsistencia, setVisibleDialogAsistencia] = useState(false);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);

  // ===== LINK DE MEET (cuotas/sala: link, descripcion) =====
  const [visibleDialogMeet, setVisibleDialogMeet] = useState(false);
  const [linkMeet, setLinkMeet] = useState("");
  const [descripcionMeet, setDescripcionMeet] = useState("");
  const [loadingMeet, setLoadingMeet] = useState(false);
  const linkInputRef = useRef(null);

  // ===== HS CÁTEDRA SECUNDARIA (cod/secundaria.valor) =====
  const [visibleDialogHsSec, setVisibleDialogHsSec] = useState(false);
  const [valorHsSec, setValorHsSec] = useState("");
  const [loadingHsSec, setLoadingHsSec] = useState(false);

  // ===== HS CÁTEDRA SUPERIOR (cod/superior.anual | cuatrimestral) =====
  const [visibleDialogHsSup, setVisibleDialogHsSup] = useState(false);
  const [valorAnualSup, setValorAnualSup] = useState("");
  const [valorCuatrSup, setValorCuatrSup] = useState("");
  const [loadingHsSup, setLoadingHsSup] = useState(false);

  // ===== SEGURO DE VIDA OBLIGATORIO (cod/seguroVidaObligatorio.valor) =====
  const [visibleDialogSeguro, setVisibleDialogSeguro] = useState(false);
  const [valorSeguro, setValorSeguro] = useState("");
  const [loadingSeguro, setLoadingSeguro] = useState(false);

  // ===== SUBSIDIO SEPELIO (cod/subsidioSepelio.valor) =====
  const [visibleDialogSepelio, setVisibleDialogSepelio] = useState(false);
  const [valorSepelio, setValorSepelio] = useState("");
  const [loadingSepelio, setLoadingSepelio] = useState(false);

  // ---------- Lecturas individuales ----------
  const cargarAsistencia = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "boton"));
      if (snap.exists()) {
        const valor = snap.data()?.cargar;
        setAsistenciaHabilitada(valor === "si" || valor === "no" ? valor : null);
      } else {
        setAsistenciaHabilitada(null);
      }
    } catch (err) {
      console.error("Asistencia (leer):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo cargar Asistencia." });
    }
  };

  const cargarMeet = async () => {
    try {
      const snap = await getDoc(doc(db, "cuotas", "sala"));
      if (snap.exists()) {
        const data = snap.data();
        setLinkMeet(typeof data?.link === "string" ? data.link : "");
        setDescripcionMeet(typeof data?.descripcion === "string" ? data.descripcion : "");
      } else {
        setLinkMeet("");
        setDescripcionMeet("");
      }
    } catch (err) {
      console.error("Meet (leer):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo cargar el enlace de Meet." });
    }
  };

  const cargarHsSec = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "secundaria"));
      setValorHsSec(snap.exists() && typeof snap.data()?.valor === "string" ? snap.data().valor : "");
    } catch (err) {
      console.error("Hs Secundaria (leer):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo cargar Hs Cát. Secundaria." });
    }
  };

  const cargarHsSup = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "superior"));
      if (snap.exists()) {
        setValorAnualSup(typeof snap.data()?.anual === "string" ? snap.data().anual : "");
        setValorCuatrSup(typeof snap.data()?.cuatrimestral === "string" ? snap.data().cuatrimestral : "");
      } else {
        setValorAnualSup("");
        setValorCuatrSup("");
      }
    } catch (err) {
      console.error("Hs Superior (leer):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo cargar Hs Cát. Superior." });
    }
  };

  const cargarSeguro = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "seguroVidaObligatorio"));
      setValorSeguro(snap.exists() && typeof snap.data()?.valor === "string" ? snap.data().valor : "");
    } catch (err) {
      console.error("Seguro Vida (leer):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo cargar Seguro de Vida Obligatorio." });
    }
  };

  const cargarSepelio = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "subsidioSepelio"));
      setValorSepelio(snap.exists() && typeof snap.data()?.valor === "string" ? snap.data().valor : "");
    } catch (err) {
      console.error("Sepelio (leer):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo cargar Subsidio Sepelio." });
    }
  };

  // ---------- Carga inicial en paralelo ----------
  useEffect(() => {
    const loadAll = async () => {
      setBootLoading(true);
      try {
        await Promise.all([
          cargarAsistencia(),
          cargarMeet(),
          cargarHsSec(),
          cargarHsSup(),
          cargarSeguro(),
          cargarSepelio(),
        ]);
      } finally {
        setBootLoading(false);
      }
    };
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Acciones ----------
  const seleccionarOpcionAsistencia = async (habilitar) => {
    if ((habilitar && asistenciaHabilitada === "si") || (!habilitar && asistenciaHabilitada === "no")) {
      setVisibleDialogAsistencia(false);
      return;
    }
    setLoadingAsistencia(true);
    try {
      await setDoc(doc(db, "cod", "boton"), { cargar: habilitar ? "si" : "no" }, { merge: true });
      setAsistenciaHabilitada(habilitar ? "si" : "no");
      toast.current?.show({ severity: "success", summary: "Guardado", detail: `Asistencia ${habilitar ? "habilitada" : "deshabilitada"}.` });
    } catch (err) {
      console.error("Asistencia (guardar):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo guardar Asistencia." });
    } finally {
      setLoadingAsistencia(false);
      setVisibleDialogAsistencia(false);
    }
  };

  const guardarLinkMeet = async () => {
    const link = (linkMeet ?? "").trim();
    const desc = (descripcionMeet ?? "").trim();
    if (link === "") {
      toast.current?.show({ severity: "warn", summary: "Atención", detail: "Pegá un enlace de Meet." });
      return;
    }
    const meetRegex = /^https?:\/\/meet\.google\.com\/[^\s]+$/i;
    if (!meetRegex.test(link)) {
      toast.current?.show({ severity: "warn", summary: "Formato", detail: "El enlace debe ser de Google Meet (https://meet.google.com/...).", });
      return;
    }
    setLoadingMeet(true);
    try {
      await setDoc(doc(db, "cuotas", "sala"), { link, descripcion: desc }, { merge: true });
      setLinkMeet(link);
      setDescripcionMeet(desc);
      toast.current?.show({ severity: "success", summary: "Guardado", detail: "Enlace de Meet guardado." });
      setVisibleDialogMeet(false);
    } catch (err) {
      console.error("Meet (guardar):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo guardar el enlace." });
    } finally {
      setLoadingMeet(false);
    }
  };

  const borrarLinkMeet = async () => {
    setLoadingMeet(true);
    try {
      await setDoc(doc(db, "cuotas", "sala"), { link: "", descripcion: "" }, { merge: true });
      setLinkMeet("");
      setDescripcionMeet("");
      toast.current?.show({ severity: "success", summary: "Eliminado", detail: "Se borró el enlace y la descripción." });
      setVisibleDialogMeet(false);
    } catch (err) {
      console.error("Meet (borrar):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo borrar el enlace." });
    } finally {
      setLoadingMeet(false);
    }
  };

  const guardarValorHsSec = async () => {
    const num = parseFloat(valorHsSec);
    if (isNaN(num)) {
      toast.current?.show({ severity: "warn", summary: "Atención", detail: "Ingrese un número válido." });
      return;
    }
    const formateado = num.toFixed(2);
    if (formateado === valorHsSec) {
      setVisibleDialogHsSec(false);
      return;
    }
    setLoadingHsSec(true);
    try {
      await setDoc(doc(db, "cod", "secundaria"), { valor: formateado }, { merge: true });
      setValorHsSec(formateado);
      toast.current?.show({ severity: "success", summary: "Guardado", detail: "Valor guardado correctamente." });
      setVisibleDialogHsSec(false);
    } catch (err) {
      console.error("Hs Secundaria (guardar):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo guardar el valor." });
    } finally {
      setLoadingHsSec(false);
    }
  };

  const guardarValorHsSup = async () => {
    const numAnual = parseFloat(valorAnualSup);
    const numCuatr = parseFloat(valorCuatrSup);
    if (isNaN(numAnual) || isNaN(numCuatr)) {
      toast.current?.show({ severity: "warn", summary: "Atención", detail: "Ingrese ambos valores numéricos." });
      return;
    }
    const anualForm = numAnual.toFixed(2);
    const cuatrForm = numCuatr.toFixed(2);
    if (anualForm === valorAnualSup && cuatrForm === valorCuatrSup) {
      setVisibleDialogHsSup(false);
      return;
    }
    setLoadingHsSup(true);
    try {
      await setDoc(doc(db, "cod", "superior"), { anual: anualForm, cuatrimestral: cuatrForm }, { merge: true });
      setValorAnualSup(anualForm);
      setValorCuatrSup(cuatrForm);
      toast.current?.show({ severity: "success", summary: "Guardado", detail: "Valores guardados correctamente." });
      setVisibleDialogHsSup(false);
    } catch (err) {
      console.error("Hs Superior (guardar):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudieron guardar los valores." });
    } finally {
      setLoadingHsSup(false);
    }
  };

  const guardarValorSeguro = async () => {
    const num = parseFloat(valorSeguro.replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) {
      toast.current?.show({ severity: "warn", summary: "Atención", detail: "Ingrese un número válido." });
      return;
    }
    const formateado = num.toLocaleString("es-AR"); // ej: "1.000"
    if (formateado === valorSeguro) {
      setVisibleDialogSeguro(false);
      return;
    }
    setLoadingSeguro(true);
    try {
      await setDoc(doc(db, "cod", "seguroVidaObligatorio"), { valor: formateado }, { merge: true });
      setValorSeguro(formateado);
      toast.current?.show({ severity: "success", summary: "Guardado", detail: "Valor guardado correctamente." });
      setVisibleDialogSeguro(false);
    } catch (err) {
      console.error("Seguro Vida (guardar):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo guardar el valor." });
    } finally {
      setLoadingSeguro(false);
    }
  };

  const guardarValorSepelio = async () => {
    const num = parseFloat(valorSepelio.replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) {
      toast.current?.show({ severity: "warn", summary: "Atención", detail: "Ingrese un número válido." });
      return;
    }
    const formateado = num.toLocaleString("es-AR"); // ej: "30.000"
    if (formateado === valorSepelio) {
      setVisibleDialogSepelio(false);
      return;
    }
    setLoadingSepelio(true);
    try {
      await setDoc(doc(db, "cod", "subsidioSepelio"), { valor: formateado }, { merge: true });
      setValorSepelio(formateado);
      toast.current?.show({ severity: "success", summary: "Guardado", detail: "Valor guardado correctamente." });
      setVisibleDialogSepelio(false);
    } catch (err) {
      console.error("Sepelio (guardar):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo guardar el valor." });
    } finally {
      setLoadingSepelio(false);
    }
  };

  // ---------- Labels / iconos ----------
  const botonLabelAsistencia =
    asistenciaHabilitada === null ? "Habilitar Asistencia" : asistenciaHabilitada === "si" ? "Asistencia: Sí" : "Asistencia: No";
  const botonIconAsistencia =
    asistenciaHabilitada === null ? "pi pi-check-square" : asistenciaHabilitada === "si" ? "pi pi-check" : "pi pi-times";
  const botonSeverityAsistencia = asistenciaHabilitada === null ? "secondary" : asistenciaHabilitada === "si" ? "success" : "danger";

  const hayLinkMeet = (linkMeet ?? "").trim() !== "";
  const botonLabelMeet = hayLinkMeet ? "Link Meet Cargado" : "Cargar Link de Meet";
  const botonIconMeet = hayLinkMeet ? "pi pi-link" : "pi pi-video";
  const botonSeverityMeet = hayLinkMeet ? "success" : "info";

  const hayValorHsSec = valorHsSec.trim() !== "";
  const botonLabelHsSec = hayValorHsSec ? `Hs Cát. Sec.: $ ${valorHsSec}` : "Valor de la Hs Cátedra Secundaria.";
  const botonIconHsSec = hayValorHsSec ? "pi pi-check-circle" : "pi pi-dollar";
  const botonSeverityHsSec = hayValorHsSec ? "success" : "warning";

  const hayValorHsSup = valorAnualSup.trim() !== "" && valorCuatrSup.trim() !== "";
  const botonLabelHsSup = hayValorHsSup ? `Hs Cát. Sup.: Anual $${valorAnualSup} / Cuatr. $${valorCuatrSup}` : "Valor de la Hs Cátedra Superior.";
  const botonIconHsSup = hayValorHsSup ? "pi pi-check-circle" : "pi pi-dollar";
  const botonSeverityHsSup = hayValorHsSup ? "success" : "warning";

  const hayValorSeguro = valorSeguro.trim() !== "";
  const botonLabelSeguro = hayValorSeguro ? `Seguro Vida: $ ${valorSeguro}` : "Seguro de Vida Obligatorio";
  const botonIconSeguro = hayValorSeguro ? "pi pi-check-circle" : "pi pi-shield";
  const botonSeveritySeguro = hayValorSeguro ? "success" : "help";

  const hayValorSepelio = valorSepelio.trim() !== "";
  const botonLabelSepelio = hayValorSepelio ? `Sepelio: $ ${valorSepelio}` : "Subsidio Sepelio";
  const botonIconSepelio = hayValorSepelio ? "pi pi-check-circle" : "pi pi-briefcase";
  const botonSeveritySepelio = hayValorSepelio ? "success" : "help";

  // ---------- Splash de carga inicial ----------
  if (bootLoading) {
    return (
      <div
        style={{
          minHeight: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "0.75rem",
          background: "rgba(255,255,255,0.6)",
          borderRadius: 12,
        }}
      >
        <ProgressSpinner />
        <span style={{ color: "#64748b" }}>Cargando configuración…</span>
      </div>
    );
  }

  // ===================== RENDER =====================
  return (
    <div className={styles.habilitar_funciones}>
      <Toast ref={toast} />
      <h3 className={styles.habilitar_titulo}>🛠 Habilitar Botones</h3>

      <div className={styles.habilitar_botones}>
        {/* Asistencia */}
        <Button
          label={botonLabelAsistencia}
          icon={botonIconAsistencia}
          severity={botonSeverityAsistencia}
          onClick={() => setVisibleDialogAsistencia(true)}
          loading={loadingAsistencia}
        />

        {/* Link de Meet */}
        <Button
          label={botonLabelMeet}
          icon={botonIconMeet}
          severity={botonSeverityMeet}
          onClick={() => setVisibleDialogMeet(true)}
          loading={loadingMeet}
        />

        {/* Secundaria */}
        <Button
          label={botonLabelHsSec}
          icon={botonIconHsSec}
          severity={botonSeverityHsSec}
          onClick={() => setVisibleDialogHsSec(true)}
          loading={loadingHsSec}
        />

        {/* Superior */}
        <Button
          label={botonLabelHsSup}
          icon={botonIconHsSup}
          severity={botonSeverityHsSup}
          onClick={() => setVisibleDialogHsSup(true)}
          loading={loadingHsSup}
        />

        {/* Seguro de Vida Obligatorio */}
        <Button
          label={botonLabelSeguro}
          icon={botonIconSeguro}
          severity={botonSeveritySeguro}
          onClick={() => setVisibleDialogSeguro(true)}
          loading={loadingSeguro}
        />

        {/* Subsidio Sepelio */}
        <Button
          label={botonLabelSepelio}
          icon={botonIconSepelio}
          severity={botonSeveritySepelio}
          onClick={() => setVisibleDialogSepelio(true)}
          loading={loadingSepelio}
        />
      </div>

      {/* ===== Modal Asistencia ===== */}
      <Dialog
        header="Habilitar Asistencia"
        visible={visibleDialogAsistencia}
        style={{ width: "350px" }}
        modal
        onHide={() => setVisibleDialogAsistencia(false)}
      >
        <p>¿Desea habilitar la asistencia?</p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1rem" }}>
          <Button
            label="Sí"
            icon="pi pi-check"
            severity="success"
            outlined={asistenciaHabilitada !== "si"}
            onClick={() => seleccionarOpcionAsistencia(true)}
            loading={loadingAsistencia}
          />
          <Button
            label="No"
            icon="pi pi-times"
            severity="danger"
            outlined={asistenciaHabilitada !== "no"}
            onClick={() => seleccionarOpcionAsistencia(false)}
            loading={loadingAsistencia}
          />
        </div>
      </Dialog>

      {/* ===== Modal Link de Meet ===== */}
      <Dialog
        header="Cargar Link de Meet"
        visible={visibleDialogMeet}
        style={{ width: "460px" }}
        modal
        onShow={() => linkInputRef.current?.focus?.()}
        onHide={() => setVisibleDialogMeet(false)}
      >
        <p>Pegá el enlace de Google Meet y una descripción opcional.</p>

        <div style={{ marginBottom: "1rem" }}>
          <label><strong>Enlace (https://meet.google.com/...):</strong></label>
          <InputText
            ref={linkInputRef}
            value={linkMeet}
            onChange={(e) => setLinkMeet(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label><strong>Descripción:</strong></label>
          <InputText
            value={descripcionMeet}
            onChange={(e) => setDescripcionMeet(e.target.value)}
            placeholder="Reunión mensual / Docentes 3° año"
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem", flexWrap: "wrap" }}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardarLinkMeet} disabled={loadingMeet} loading={loadingMeet} />
          <Button label="Borrar" icon="pi pi-trash" severity="warning" onClick={borrarLinkMeet} disabled={loadingMeet || (linkMeet.trim() === "" && descripcionMeet.trim() === "")} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialogMeet(false)} disabled={loadingMeet} />
        </div>
      </Dialog>

      {/* ===== Modal Secundaria ===== */}
      <Dialog
        header="Valor de la Hora Cátedra Secundaria"
        visible={visibleDialogHsSec}
        style={{ width: "420px" }}
        modal
        onHide={() => setVisibleDialogHsSec(false)}
      >
        <p>Ingrese el valor (se guardará como texto con 2 decimales, ej: 32706.56).</p>
        <InputText
          type="number"
          step="0.01"
          value={valorHsSec}
          onChange={(e) => setValorHsSec(e.target.value)}
          placeholder="Ej: 32706.56"
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorHsSec}
            disabled={valorHsSec.trim() === "" || loadingHsSec}
            loading={loadingHsSec}
          />
          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleDialogHsSec(false)}
            disabled={loadingHsSec}
          />
        </div>
      </Dialog>

      {/* ===== Modal Superior ===== */}
      <Dialog
        header="Valor de la Hora Cátedra Superior"
        visible={visibleDialogHsSup}
        style={{ width: "460px" }}
        modal
        onHide={() => setVisibleDialogHsSup(false)}
      >
        <p>Ingrese los valores (se guardarán como texto con 2 decimales).</p>
        <div style={{ marginBottom: "1rem" }}>
          <label><strong>Anual:</strong></label>
          <InputText
            type="number"
            step="0.01"
            value={valorAnualSup}
            onChange={(e) => setValorAnualSup(e.target.value)}
            placeholder="Ej: 32706.56"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label><strong>Cuatrimestral:</strong></label>
          <InputText
            type="number"
            step="0.01"
            value={valorCuatrSup}
            onChange={(e) => setValorCuatrSup(e.target.value)}
            placeholder="Ej: 16353.28"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorHsSup}
            disabled={valorAnualSup.trim() === "" || valorCuatrSup.trim() === "" || loadingHsSup}
            loading={loadingHsSup}
          />
          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleDialogHsSup(false)}
            disabled={loadingHsSup}
          />
        </div>
      </Dialog>

      {/* ===== Modal Seguro Vida ===== */}
      <Dialog
        header="Seguro de Vida Obligatorio"
        visible={visibleDialogSeguro}
        style={{ width: "420px" }}
        modal
        onHide={() => setVisibleDialogSeguro(false)}
      >
        <p>Ingrese el valor (se guardará como texto con separador de miles, ej: 1.000).</p>
        <InputText
          value={valorSeguro}
          onChange={(e) => setValorSeguro(e.target.value)}
          placeholder="Ej: 1.000"
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorSeguro}
            disabled={valorSeguro.trim() === "" || loadingSeguro}
            loading={loadingSeguro}
          />
          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleDialogSeguro(false)}
            disabled={loadingSeguro}
          />
        </div>
      </Dialog>

      {/* ===== Modal Subsidio Sepelio ===== */}
      <Dialog
        header="Subsidio Sepelio"
        visible={visibleDialogSepelio}
        style={{ width: "420px" }}
        modal
        onHide={() => setVisibleDialogSepelio(false)}
      >
        <p>Ingrese el valor (se guardará como texto con separador de miles, ej: 30.000).</p>
        <InputText
          value={valorSepelio}
          onChange={(e) => setValorSepelio(e.target.value)}
          placeholder="Ej: 30.000"
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorSepelio}
            disabled={valorSepelio.trim() === "" || loadingSepelio}
            loading={loadingSepelio}
          />
          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleDialogSepelio(false)}
            disabled={loadingSepelio}
          />
        </div>
      </Dialog>
    </div>
  );
};

export default HabilitarBotones;

