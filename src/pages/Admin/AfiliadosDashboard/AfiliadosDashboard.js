// src/pages/Admin/AfiliadosDashboard/AfiliadosDashboard.js
import React, { useMemo, useState } from "react";
import "chart.js/auto";

import AfiliadosPorDepartamento from "../../../components/dashboard/AfiliadosPorDepartamento";
import AltasBajasMensual from "../../../components/dashboard/AltasBajasMensual";
import AfiliadoAdherenteResumen from "../../../components/dashboard/AfiliadoAdherenteResumen";
import CursosDashboardSection from "../../../components/dashboard/CursosDashboardSection";
import RegistroAsistencia from "../../../components/dashboard/RegistroAsistencia";
import DetalleInformacionAfiliado from "../../../components/dashboard/DetalleInformacionAfiliado";
import PadronDashboardSection from "../../../components/dashboard/PadronDashboardSection";
import DispositivosBloqueados from "../../../components/dashboard/DispositivosBloqueados";

import styles from "./afiliadosDashboard.module.css";

const AfiliadosDashboard = () => {
  const currentYear = new Date().getFullYear();
  const startYear = 2021;

  const years = useMemo(() => {
    return Array.from(
      { length: currentYear - startYear + 1 },
      (_, index) => currentYear - index
    );
  }, [currentYear]);

  const [activeTab, setActiveTab] = useState("dept");

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard de Afiliados y Cursos</h1>
        <span className={styles.subtitle}>
          Vista general de afiliados por departamento, adherentes, información
          personal, cursos, docentes aprobados, asistencia y control de padrón.
        </span>
      </div>

      <div className={styles.tabsRow}>
        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "dept" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("dept")}
        >
          Afiliados por departamento
        </button>

        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "altas" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("altas")}
        >
          Altas y bajas mensuales
        </button>

        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "adherentes" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("adherentes")}
        >
          Afiliado Adherente
        </button>

        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "info" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("info")}
        >
          Información del afiliado
        </button>

        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "cursos" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("cursos")}
        >
          Cursos
        </button>

        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "asistencia" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("asistencia")}
        >
          Registro de asistencia
        </button>

        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "padron" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("padron")}
        >
          Padrón
        </button>

        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "dispositivos" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("dispositivos")}
        >
          Dispositivos bloqueados
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === "dept" && <AfiliadosPorDepartamento />}

        {activeTab === "altas" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            {years.map((year) => (
              <AltasBajasMensual key={year} year={year} />
            ))}
          </div>
        )}

        {activeTab === "adherentes" && <AfiliadoAdherenteResumen />}

        {activeTab === "info" && <DetalleInformacionAfiliado />}

        {activeTab === "cursos" && (
          <CursosDashboardSection year={currentYear} />
        )}

        {activeTab === "asistencia" && (
          <RegistroAsistencia year={currentYear} />
        )}

        {activeTab === "padron" && <PadronDashboardSection />}
        {activeTab === "dispositivos" && <DispositivosBloqueados />}
      </div>
    </div>
  );
};

export default AfiliadosDashboard;
