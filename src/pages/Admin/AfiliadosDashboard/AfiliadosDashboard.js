// src/pages/Admin/AfiliadosDashboard/AfiliadosDashboard.js
import React, { useState } from "react";
import "chart.js/auto";

import AfiliadosPorDepartamento from "../../../components/dashboard/AfiliadosPorDepartamento";
import AltasBajasMensual from "../../../components/dashboard/AltasBajasMensual";
import AfiliadoAdherenteResumen from "../../../components/dashboard/AfiliadoAdherenteResumen";
import CursosDashboardSection from "../../../components/dashboard/CursosDashboardSection";
import RegistroAsistencia from "../../../components/dashboard/RegistroAsistencia";
import DetalleInformacionAfiliado from "../../../components/dashboard/DetalleInformacionAfiliado";

import styles from "./afiliadosDashboard.module.css";

const AfiliadosDashboard = () => {
  // Año fijo para los gráficos (podés cambiarlo acá si hace falta)
  const year = 2025;

  // pestaña activa
  // dept | altas | adherentes | info | cursos | asistencia
  const [activeTab, setActiveTab] = useState("dept");

  return (
    <div className={styles.container}>
      {/* Título */}
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard de Afiliados y Cursos</h1>
        <span className={styles.subtitle}>
          Vista general de afiliados por departamento, adherentes, información
          personal, cursos, docentes aprobados y asistencia.
        </span>
      </div>

      {/* Pestañas */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabButton} ${
            activeTab === "dept" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("dept")}
        >
          Afiliados por departamento
        </button>

        <button
          className={`${styles.tabButton} ${
            activeTab === "altas" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("altas")}
        >
          Altas y bajas mensuales
        </button>

        <button
          className={`${styles.tabButton} ${
            activeTab === "adherentes" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("adherentes")}
        >
          Afiliado Adherente
        </button>

        <button
          className={`${styles.tabButton} ${
            activeTab === "info" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("info")}
        >
          Información del afiliado
        </button>

        <button
          className={`${styles.tabButton} ${
            activeTab === "cursos" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("cursos")}
        >
          Cursos
        </button>

        <button
          className={`${styles.tabButton} ${
            activeTab === "asistencia" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("asistencia")}
        >
          Registro de asistencia
        </button>
      </div>

      {/* Contenido de cada pestaña */}
      <div className={styles.tabContent}>
        {activeTab === "dept" && <AfiliadosPorDepartamento />}

        {activeTab === "altas" && <AltasBajasMensual year={year} />}

        {activeTab === "adherentes" && <AfiliadoAdherenteResumen />}

        {activeTab === "info" && <DetalleInformacionAfiliado />}

        {activeTab === "cursos" && <CursosDashboardSection year={year} />}

        {activeTab === "asistencia" && <RegistroAsistencia year={year} />}
      </div>
    </div>
  );
};

export default AfiliadosDashboard;
