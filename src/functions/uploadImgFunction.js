import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

export const uploadImgFunction = (
  dispatch,
  file,
  uploadImgProcess,  // onStart
  uploadImgSuccess,  // onSuccess (recibe string URL)
  uploadImgError,    // onError
  uploadProgress     // onProgress (0..100)
) => {
  // 1) Validación básica
  if (!file) {
    dispatch(uploadImgError("No se seleccionó ningún archivo"));
    return;
  }

  // 2) Tipos de imagen permitidos
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    dispatch(
      uploadImgError(
        "Formato no permitido. Usá imágenes JPG, JPEG, PNG o WEBP."
      )
    );
    return;
  }

  try {
    // 3) Avisamos que comienza la subida
    dispatch(uploadImgProcess());

    const storage = getStorage();

    const safeName = file.name.replace(/\s+/g, "_");
    // Podés cambiar la carpeta si querés (ej: "novedades/")
    const path = `cursos/${Date.now()}_${safeName}`;

    const metadata = { contentType: file.type };

    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    // 4) Escuchamos progreso / error / finalización
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        dispatch(uploadProgress(progress));
      },
      (error) => {
        console.error("[uploadImgFunction] error:", error);
        let message = "No se pudo subir la imagen";

        switch (error.code) {
          case "storage/unauthorized":
            message = "No tenés permisos para subir archivos";
            break;
          case "storage/canceled":
            message = "Se canceló la subida";
            break;
          default:
            if (error.message) message = error.message;
            break;
        }

        dispatch(uploadImgError(message));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log("[uploadImgFunction] URL lista:", downloadURL);
          // 👇 Enviamos SOLO el string, el action creator ya arma { msg, img }
          dispatch(uploadImgSuccess(downloadURL));
        } catch (e) {
          console.error("[uploadImgFunction] getDownloadURL error:", e);
          dispatch(
            uploadImgError(
              e?.message || "No se pudo obtener la URL de la imagen."
            )
          );
        }
      }
    );
  } catch (error) {
    console.error("[uploadImgFunction] catch:", error);
    dispatch(
      uploadImgError(
        error?.message || "No se pudo subir la imagen. Intentalo más tarde."
      )
    );
  }
};

