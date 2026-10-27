import { textValue } from "./titularizacionNormalizer";

const explicitResolutionNumber = (value) => {
  const text = textValue(value).trim();
  if (!text) return null;

  const resge = text.match(/\bRESGE[-\s]?\d{4}[-\s]?(\d+)[-\s]?E(?:[-\s]|$)/i);
  if (resge) return resge[1];

  const labeled = text.match(/\bRES(?:OLUCI[ÓO]N)?\s*(?:N[º°O.]?\s*)?(\d+)\b/i);
  if (labeled) return labeled[1];

  if (/^\d+$/.test(text)) return text;
  return null;
};

/**
 * Devuelve sólo el número de resolución cuando existe metadata estructurada
 * o una referencia explícita. Nunca interpreta números libres del nombre.
 */
export const extractResolutionNumber = (...values) => {
  for (const value of values) {
    const number = explicitResolutionNumber(value);
    if (number) return number;
  }
  return null;
};

