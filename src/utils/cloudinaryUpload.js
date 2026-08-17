// src/utils/cloudinaryUpload.js
//
// Subida de imágenes a Cloudinary mediante unsigned upload preset.
//
// El proyecto ya usa Cloudinary en Casa del Docente
// (pages/Admin/ReservaCasaDocente/HabitacionesAdmin.js) porque Firebase
// Storage devolvía 402 por límite de cuota. Se reutiliza aquí la misma
// cuenta y el mismo preset, sin modificar aquel módulo.
//
// A diferencia de la subida de Casa del Docente, esta devuelve también el
// public_id, que el módulo de certificados guarda en imagenPublicId.

const CLOUDINARY_CLOUD = "djoxsp29x";
const CLOUDINARY_PRESET = "ml2p3pjq";

export const PROVEEDOR_CLOUDINARY = "cloudinary";

/** Formatos de imagen aceptados para las firmas. */
export const TIPOS_IMAGEN_PERMITIDOS = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

/** Límite de tamaño por archivo. Una firma recortada pesa muy poco. */
export const TAMANIO_MAXIMO_MB = 3;

const TAMANIO_MAXIMO_BYTES = TAMANIO_MAXIMO_MB * 1024 * 1024;

/**
 * Valida un archivo antes de subirlo.
 * Devuelve el mensaje de error, o null si el archivo es válido.
 */
export const validarImagen = (file) => {
  if (!file) return "No se seleccionó ningún archivo.";

  if (!TIPOS_IMAGEN_PERMITIDOS.includes(file.type)) {
    return "Formato no permitido. Usá JPG, JPEG, PNG o WEBP.";
  }

  if (file.size > TAMANIO_MAXIMO_BYTES) {
    return `La imagen supera los ${TAMANIO_MAXIMO_MB} MB permitidos.`;
  }

  return null;
};

/**
 * Sube una imagen y devuelve { url, publicId, proveedor }.
 *
 * @param {File} file
 * @param {string} carpeta Carpeta destino dentro de Cloudinary.
 */
export const subirImagenCloudinary = async (file, carpeta = "sidca") => {
  const error = validarImagen(file);
  if (error) throw new Error(error);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  formData.append("folder", carpeta);

  let respuesta;

  try {
    respuesta = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: formData }
    );
  } catch (e) {
    throw new Error("No se pudo conectar con el servidor de imágenes.");
  }

  if (!respuesta.ok) {
    throw new Error(`No se pudo subir la imagen (Cloudinary ${respuesta.status}).`);
  }

  const datos = await respuesta.json();

  return {
    url: datos.secure_url || "",
    publicId: datos.public_id || "",
    proveedor: PROVEEDOR_CLOUDINARY,
  };
};
