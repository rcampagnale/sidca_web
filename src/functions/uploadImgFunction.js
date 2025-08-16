import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export const uploadImgFunction = async (
  dispatch,
  file,
  uploadImgProcess,   // onStart
  uploadImgSuccess,   // onSuccess (debe recibir string)
  uploadImgError,     // onError
  uploadProgress      // onProgress (recibe número 0..100)
) => {
  // Validación básica
  if (!file) {
    dispatch(uploadImgError('No se seleccionó ningún archivo'));
    return;
  }

  try {
    dispatch(uploadImgProcess());

    const storage = getStorage();

    // contentType dinámico (fallback a image/jpeg)
    const contentType = file.type && file.type.startsWith('image/')
      ? file.type
      : 'image/jpeg';

    /** @type {any} */
    const metadata = { contentType };

    // Nombre de archivo seguro y con timestamp
    const safeName = file.name.replace(/\s+/g, '_');
    const path = `novedades/${Date.now()}_${safeName}`;

    // Subida con metadata
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file, metadata);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        dispatch(uploadProgress(progress));
      },
      (error) => {
        // Errores comunes de Firebase Storage
        switch (error.code) {
          case 'storage/unauthorized':
            dispatch(uploadImgError('No tenés permisos para subir archivos'));
            break;
          case 'storage/canceled':
            dispatch(uploadImgError('Se canceló la subida'));
            break;
          default:
            dispatch(uploadImgError(error.message || 'No se pudo subir la imagen'));
            break;
        }
      },
      async () => {
        // ✅ URL STRING
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        // Enviamos SOLO el string
        dispatch(uploadImgSuccess(downloadURL));
      }
    );
  } catch (error) {
    dispatch(uploadImgError('No se pudo subir la imagen. Inténtalo más tarde'));
    console.log(error);
  }
};
