import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export const uploadImgFunction = async (dispatch, file, uploadImgProcess, uploadImgSuccess, uploadImgError, uploadProgress) => {
    dispatch(uploadImgProcess());
    try {

        const storage = getStorage();
        // Create the file metadata2
        /** @type {any} */
        const metadata = {
            contentType: 'image/jpeg'
        };

        // Upload file and metadata to the object 'images/mountains.jpg'
        const storageRef = ref(storage, 'img/' + file.name + Date.now());
        const uploadTask = uploadBytesResumable(storageRef, file, metadata);

        // Listen for state changes, errors, and completion of the upload.
        uploadTask.on('state_changed',
            (snapshot) => {
                // Get task progress, including the number of bytes uploaded and the total number of bytes to be uploaded
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
                switch (snapshot.state) {
                    case 'paused':
                        dispatch(uploadImgError('Se ha detenido el proceso de subida'));
                        break;
                    case 'running':
                        dispatch(uploadProgress(progress))
                        break;
                }
            },
            (error) => {
                // A full list of error codes is available at
                // https://firebase.google.com/docs/storage/web/handle-errors
                switch (error.code) {
                    case 'storage/unauthorized':
                        dispatch(uploadImgError('No tienen permisos para subir archivos'));
                        break;
                    case 'storage/canceled':
                        dispatch(uploadImgError('Se ha cancelado la subida'));
                        break;
                    case 'storage/unknown':
                        dispatch(uploadImgError('No se ha podido subir la imagen. Error desconocido'));
                        break;
                }
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    dispatch(uploadImgSuccess({ msg: `Imagen Subida con exito.`, img: downloadURL }));
                });
            }
        );
    } catch (error) {
        dispatch(uploadImgError('No se ha podido subir la imagen. intentalo mas tarde'));
        console.log(error)
    }
}