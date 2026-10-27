import {
  nombreInstitucionOrganizadora,
  OPCIONES_INSTITUCIONES_ORGANIZADORAS,
  normalizarInstitucionOrganizadora,
  resolverInstitucionOrganizadora,
  obtenerTextoAuspicioMinisterio,
  textoAuspicioConResolucion,
  construirTextoMinisterio,
  formatearTituloMinisterio,
} from "./ministerioCertificado";
import { construirPayloadConfiguracionCertificado } from "../../../../services/certificadosService";

test("resuelve el nombre institucional exacto de SIDCA", () => {
  expect(normalizarInstitucionOrganizadora("SiDCa")).toBe("sidca");
  expect(
    nombreInstitucionOrganizadora({
      institucionCertificado: "ministerio",
      institucionOrganizadora: "sidca",
    })
  ).toBe("SINDICATO DE DOCENTES DE CATAMARCA - SI.D.CA.");
});

test("resuelve el nombre institucional exacto de ITM", () => {
  expect(normalizarInstitucionOrganizadora("instituto tecnológico municipal")).toBe("itm");
  expect(
    nombreInstitucionOrganizadora({
      institucionCertificado: "ministerio",
      institucionOrganizadora: "ITM",
    })
  ).toBe("INSTITUTO TECNOLOGICO MUNICIPAL (I.T.M)");
});

test("separa la etiqueta visible de la denominación impresa sin cambiar el valor interno", () => {
  const opcionItm = OPCIONES_INSTITUCIONES_ORGANIZADORAS.find(
    (opcion) => opcion.value === "itm"
  );

  expect(opcionItm).toEqual({
    value: "itm",
    label: "INSTITUTO TECNOLÓGICO MUNICIPAL (I.T.M)",
  });
  expect(normalizarInstitucionOrganizadora("INSTITUTO TECNOLÓGICO MUNICIPAL")).toBe("itm");
  expect(normalizarInstitucionOrganizadora("INSTITUTO TECNOLOGICO MUNICIPAL (I.T.M)")).toBe("itm");
});

test("no confunde el modelo Ministerio con la institución organizadora", () => {
  expect(resolverInstitucionOrganizadora({ institucionCertificado: "ministerio" })).toBe("");
  expect(nombreInstitucionOrganizadora({ institucionCertificado: "ministerio" })).toBe("");
});

test("usa el default sólo cuando falta textoAuspicio y conserva una edición vacía", () => {
  expect(obtenerTextoAuspicioMinisterio({})).toContain(
    "Este evento de capacitación"
  );
  expect(obtenerTextoAuspicioMinisterio({})).not.toContain(
    "S.I.E.(MECYT) N°"
  );
  expect(
    obtenerTextoAuspicioMinisterio({
      textoAuspicio: "Texto personalizado de prueba",
    })
  ).toBe("Texto personalizado de prueba");
  expect(obtenerTextoAuspicioMinisterio({ textoAuspicio: "" })).toBe("");
});

test("preserva el texto guardado sin reinyectar la etiqueta de resolución", () => {
  const textoGuardado =
    "Este evento fue auspiciado por el Ministerio, a través de Resolución";

  expect(
    obtenerTextoAuspicioMinisterio({ textoAuspicio: textoGuardado })
  ).toBe(textoGuardado);
});

test("envía textoAuspicio personalizado en el payload Ministerio", () => {
  const payload = construirPayloadConfiguracionCertificado({
    institucionCertificado: "ministerio",
    textoAuspicio: "Texto personalizado de prueba",
    resolucion: "RESOL-2026-35-E-CAT-SICE#MET",
  });

  expect(payload.textoAuspicio).toBe("Texto personalizado de prueba");
  expect(payload.resolucion).toBe("RESOL-2026-35-E-CAT-SICE#MET");
});

test("compone textoAuspicio literal y resolución independiente", () => {
  expect(
    textoAuspicioConResolucion(
      "Texto personalizado de prueba",
      "RESOL-2026-35-E-CAT-SICE#MET"
    )
  ).toBe(
    "Texto personalizado de prueba RESOL-2026-35-E-CAT-SICE#MET."
  );
});

test("mantiene el prefijo después de un texto que termina en Resolución", () => {
  expect(
    textoAuspicioConResolucion(
      "Este evento fue auspiciado por el Ministerio, a través de Resolución",
      "RESOL-2026-35-E-CAT-SICE#MET"
    )
  ).toBe(
    "Este evento fue auspiciado por el Ministerio, a través de Resolución RESOL-2026-35-E-CAT-SICE#MET."
  );
});

test("mantiene literalmente el texto posterior a Resolución", () => {
  expect(
    textoAuspicioConResolucion(
      "Resolución emitida para el evento",
      "RESOL-2026-35-E-CAT-SICE#MET"
    )
  ).toBe(
    "Resolución emitida para el evento RESOL-2026-35-E-CAT-SICE#MET."
  );
});

test("no depende de que el texto contenga la palabra Resolución", () => {
  expect(
    textoAuspicioConResolucion(
      "Texto personalizado cualquiera",
      "RESOL-2026-35-E-CAT-SICE#MET"
    )
  ).toBe(
    "Texto personalizado cualquiera RESOL-2026-35-E-CAT-SICE#MET."
  );
});

test("no duplica el prefijo de configuraciones legacy", () => {
  expect(
    textoAuspicioConResolucion(
      "Texto legacy Resolución S.I.E.(MECYT) N°",
      "RESOL-2026-35-E-CAT-SICE#MET"
    )
  ).toBe(
    "Texto legacy Resolución RESOL-2026-35-E-CAT-SICE#MET."
  );
});

const configuracionCanonica = {
  institucionCertificado: "ministerio",
  institucionOrganizadora: "sidca",
  tipoActividad: "CURSO",
  titulo: "POR UNA PEDAGOGÍA DEL CUIDADO II: SUICIDIO Y PROBLEMÁTICAS EMERGENTES.",
  modalidad: "HÍBRIDO",
  fechaInicio: "2026-08-07",
  fechaFin: "2026-08-15",
  localidad: "SAN FERNANDO DEL VALLE",
  departamento: "CAPITAL",
  cargaHoraria: "36",
  niveles: ["SUPERIOR", "INICIAL", "SECUNDARIO", "PRIMARIO"],
  textoEvaluacion: "y el correspondiente trabajo de evaluación.",
  textoAuspicio:
    "Este evento de capacitación, fortalecimiento y actualización docente fue auspiciado por el Ministerio de Educación y Trabajo, a través de Resolución",
  resolucion: "RESOL-2026-35-E-CAT-SICE#MET",
  fecha: "2026-10-14",
};

test("compone el texto canónico del Modelo Ministerio", () => {
  const textos = construirTextoMinisterio(configuracionCanonica, {
    apellidoNombre: "PRUEBA UNO, USUARIO UNO",
    dni: "123456789",
  });

  expect(textos.titulo).toBe(
    '"POR UNA PEDAGOGÍA DEL CUIDADO II: SUICIDIO Y PROBLEMÁTICAS EMERGENTES."'
  );
  expect(textos.participante).toBe(
    "Que PRUEBA UNO, USUARIO UNO D.N.I. N° 123456789"
  );
  expect(textos.actividad).toBe("Participó y aprobó el CURSO denominado");
  expect(textos.dictado).toBe(
    "Dictado de manera HÍBRIDO, desde 07/08/26 al 15/08/26, en la Localidad de SAN FERNANDO DEL VALLE -DPTO CAPITAL"
  );
  expect(textos.duracion).toBe(
    "con una duración de 36 horas cátedra, y el correspondiente trabajo de evaluación."
  );
  expect(textos.niveles).toBe(
    "Para los niveles INICIAL, PRIMARIO, SECUNDARIO y SUPERIOR."
  );
  expect(textos.auspicio).toBe(
    "Este evento de capacitación, fortalecimiento y actualización docente fue auspiciado por el Ministerio de Educación y Trabajo, a través de Resolución RESOL-2026-35-E-CAT-SICE#MET."
  );
  expect(textos.expedicion).toBe(
    "El presente certificado se expide en San Fernando Del Valle de Catamarca a 14 días del mes de octubre de 2026."
  );
});

test("no duplica las comillas del título al presentarlo", () => {
  expect(
    formatearTituloMinisterio(
      '“POR UNA PEDAGOGÍA DEL CUIDADO II: SUICIDIO Y PROBLEMÁTICAS EMERGENTES.”'
    )
  ).toBe(
    '"POR UNA PEDAGOGÍA DEL CUIDADO II: SUICIDIO Y PROBLEMÁTICAS EMERGENTES."'
  );
});
