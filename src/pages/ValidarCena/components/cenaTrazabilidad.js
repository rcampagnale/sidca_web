export const etiquetaTarjetaCena = (tarjeta) => {
  if (tarjeta?.tipo === "titular") return "TITULAR";
  const numero = tarjeta?.numeroAcompanante || Math.max(1, Number(tarjeta?.numeroTarjeta || 1) - 1);
  return `ACOMPAÑANTE ${numero} DE ${tarjeta?.totalAcompanantes || 0}`;
};

export const formatearFechaHoraCena = (valor) => {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  const fechaTexto = fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const horaTexto = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fechaTexto} - ${horaTexto} hs`;
};

export const fechaValidacionCena = (tarjeta) => (
  tarjeta?.fechaValidacionDisplay || formatearFechaHoraCena(tarjeta?.fechaValidacionIso || tarjeta?.fechaValidacion)
);

export const fechaAnulacionCena = (tarjeta) => (
  tarjeta?.fechaAnulacionDisplay || formatearFechaHoraCena(tarjeta?.fechaAnulacionIso || tarjeta?.fechaAnulacion)
);

const valorUsuario = (valor) => {
  if (!valor) return "";
  if (typeof valor === "string") return valor;
  return valor.nombre || valor.email || valor.correo || valor.uid || "";
};

export const usuarioValidacionCena = (tarjeta) => (
  tarjeta?.validadoPorDisplay || tarjeta?.validadoPorNombre || tarjeta?.validadoPorEmail || valorUsuario(tarjeta?.validadoPor) || tarjeta?.validadoPorUid || "Usuario no informado"
);

export const usuarioAnulacionCena = (tarjeta) => (
  tarjeta?.anuladaPorDisplay || tarjeta?.anuladaPorNombre || tarjeta?.anuladaPorEmail || valorUsuario(tarjeta?.anuladaPor) || tarjeta?.anuladaPorUid || "Usuario no informado"
);
