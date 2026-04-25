// src/components/OficinaGestion/richTextUtils.js

export const htmlATextoPlano = (html = "") => {
  if (typeof document === "undefined") {
    return String(html || "").replace(/<[^>]+>/g, " ");
  }

  const temp = document.createElement("div");
  temp.innerHTML = String(html || "");

  return (temp.textContent || temp.innerText || "").trim();
};

export const escaparHtml = (texto = "") => {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

export const textoPlanoAHtml = (texto = "") => {
  const limpio = String(texto || "").trim();

  if (!limpio) return "";

  return limpio
    .split(/\n{2,}/)
    .map((bloque) => `<p>${escaparHtml(bloque).replace(/\n/g, "<br />")}</p>`)
    .join("");
};

export const normalizarDescripcionHtml = (html = "") => {
  const limpio = String(html || "").trim();
  const textoPlano = htmlATextoPlano(limpio);

  return textoPlano ? limpio : "";
};

export const sanearHtmlBasico = (html = "") => {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
};