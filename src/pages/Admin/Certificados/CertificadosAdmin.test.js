import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import CertificadosAdmin from "./CertificadosAdmin";
import {
  guardarConfiguracionCertificado,
  obtenerConfiguracionCertificado,
} from "../../../services/certificadosService";

jest.mock("../../../services/certificadosService", () => ({
  guardarConfiguracionCertificado: jest.fn(),
  obtenerConfiguracionCertificado: jest.fn(),
  obtenerFirmaMinisterio: jest.fn(),
  subirFirmaMinisterio: jest.fn(),
}));

jest.mock("primereact/dialog", () => {
  const React = require("react");
  return {
    Dialog: ({ visible, children, footer }) =>
      visible
        ? React.createElement(
            "div",
            { role: "dialog" },
            children,
            footer
          )
        : null,
  };
});

jest.mock("primereact/toast", () => {
  const React = require("react");
  return { Toast: React.forwardRef(() => null) };
});

jest.mock("./SelectorCurso", () => {
  const React = require("react");
  return function SelectorCurso({ onSeleccionar }) {
    return React.createElement(
      "button",
      {
        type: "button",
        onClick: () => onSeleccionar({ id: "curso-1", titulo: "Curso de prueba" }),
      },
      "Seleccionar curso"
    );
  };
});

jest.mock("./MinisterioCertificado", () => {
  const React = require("react");
  return {
    __esModule: true,
    DATOS_MINISTERIO_VACIOS: {
      institucionOrganizadora: "",
      tipoActividad: "",
      fechaInicio: "",
      fechaFin: "",
      localidad: "",
      departamento: "",
      niveles: [],
      textoEvaluacion: "",
      textoAuspicio: "Texto legacy",
    },
    normalizarNivelesMinisterio: (valor) => (Array.isArray(valor) ? valor : []),
    default: ({ valores, onCambiar }) =>
      React.createElement(
        "label",
        null,
        "Texto de auspicio",
        React.createElement("textarea", {
          "aria-label": "Texto de auspicio",
          value: valores.textoAuspicio,
          onChange: (event) => onCambiar("textoAuspicio", event.target.value),
        })
      ),
  };
});

jest.mock("./InstitucionCertificado", () => ({
  __esModule: true,
  normalizarInstitucion: (valor) =>
    ["itm", "ministerio"].includes(valor) ? valor : "sidca",
  default: () => null,
}));

jest.mock("./FormularioCertificado", () => ({
  __esModule: true,
  CAMPOS_CERTIFICADO: [],
  default: () => null,
}));

jest.mock("./AutoridadesCertificado", () => ({
  __esModule: true,
  AUTORIDADES_VACIAS: [],
  normalizarDosAutoridades: (valor) => (Array.isArray(valor) ? valor : []),
  default: () => null,
}));

jest.mock("./FirmantesMinisterioCertificado", () => ({
  __esModule: true,
  normalizarFirmantesMinisterio: (valor) => (Array.isArray(valor) ? valor : []),
  default: () => null,
}));

jest.mock("./EmitirCertificados", () => () => null);
jest.mock("./ValidarCertificadoQR", () => () => null);
jest.mock("./ValidadoresCertificados", () => () => null);
jest.mock("./RegistroInscriptos", () => () => null);

test("el texto editado del textarea llega al payload de Guardar", async () => {
  obtenerConfiguracionCertificado.mockResolvedValue({
    cursoId: "curso-1",
    titulo: "Curso de prueba",
    institucionCertificado: "ministerio",
    textoAuspicio: "Texto A",
    niveles: [],
    firmantesMinisterio: [],
    estadoConfiguracion: "borrador",
  });
  guardarConfiguracionCertificado.mockResolvedValue({
    cursoId: "curso-1",
    institucionCertificado: "ministerio",
    textoAuspicio: "Texto B",
    niveles: [],
    firmantesMinisterio: [],
  });

  render(<CertificadosAdmin />);

  fireEvent.click(screen.getByRole("button", { name: "Seleccionar curso" }));

  const textarea = await screen.findByRole("textbox", {
    name: "Texto de auspicio",
  });
  expect(textarea).toHaveValue("Texto A");

  fireEvent.change(textarea, { target: { value: "Texto B" } });
  expect(textarea).toHaveValue("Texto B");

  fireEvent.click(
    screen.getByRole("button", { name: "Guardar configuración" })
  );

  await waitFor(() => expect(guardarConfiguracionCertificado).toHaveBeenCalled());

  expect(guardarConfiguracionCertificado).toHaveBeenCalledWith(
    "curso-1",
    expect.objectContaining({
      institucionCertificado: "ministerio",
      textoAuspicio: "Texto B",
    })
  );
});

test("el GET guardado conserva el valor final del textarea", async () => {
  const textoGuardado =
    "Este evento fue auspiciado por el Ministerio, a través de Resolución";

  obtenerConfiguracionCertificado.mockResolvedValue({
    cursoId: "curso-1",
    titulo: "Curso de prueba",
    institucionCertificado: "ministerio",
    textoAuspicio: textoGuardado,
    niveles: [],
    firmantesMinisterio: [],
    estadoConfiguracion: "borrador",
  });

  render(<CertificadosAdmin />);
  fireEvent.click(screen.getByRole("button", { name: "Seleccionar curso" }));

  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Texto de auspicio" })).toHaveValue(
      textoGuardado
    )
  );
});

test("la configuración gana aunque el GET llegue después del estado inicial", async () => {
  let resolver;
  obtenerConfiguracionCertificado.mockReturnValue(
    new Promise((resolve) => {
      resolver = resolve;
    })
  );

  render(<CertificadosAdmin />);
  fireEvent.click(screen.getByRole("button", { name: "Seleccionar curso" }));

  expect(
    screen.queryByRole("textbox", { name: "Texto de auspicio" })
  ).not.toBeInTheDocument();

  resolver({
    cursoId: "curso-1",
    titulo: "Curso de prueba",
    institucionCertificado: "ministerio",
    textoAuspicio: "Texto NUEVO guardado",
    niveles: [],
    firmantesMinisterio: [],
    estadoConfiguracion: "borrador",
  });

  expect(
    await screen.findByDisplayValue("Texto NUEVO guardado")
  ).toBeInTheDocument();
});

test("un textoAuspicio guardado vacío deja el textarea vacío", async () => {
  obtenerConfiguracionCertificado.mockResolvedValue({
    cursoId: "curso-1",
    titulo: "Curso de prueba",
    institucionCertificado: "ministerio",
    textoAuspicio: "",
    niveles: [],
    firmantesMinisterio: [],
    estadoConfiguracion: "borrador",
  });

  render(<CertificadosAdmin />);
  fireEvent.click(screen.getByRole("button", { name: "Seleccionar curso" }));

  const textarea = await screen.findByRole("textbox", {
    name: "Texto de auspicio",
  });
  expect(textarea).toHaveValue("");
});
