import React from 'react'

const Admin = () => {
    return (
        <div>
            <h1>Pagina Administrativa de SiDCa</h1>
            <hr />
            <h3>Agregar</h3>
            <div>
                <h4>
                    <a href="/admin/nuevo-enlace">
                        Agregar Enlace
                    </a>
                </h4>   
                <h4>
                    <a href="/admin/nuevo-curso">
                        Agregar Curso
                    </a>
                </h4>
                <h4>
                    <a href="/admin/nuevo-usuario">
                        Agregar usuario
                    </a>
                </h4>
                <h4>
                    <a href="/admin/nueva-novedad">
                        Agregar Novedad
                    </a>
                </h4>
                <h4>
                    <a href="/admin/nuevo-asesoramiento">
                        Agregar Enlace de Asesoramiento
                    </a>
                </h4>
            </div>
            <hr />
            <h3>Ver Info</h3>
            <div>
                <h4>
                    <a href="/admin/enlaces">
                        Enlaces
                    </a>
                </h4>   
                <h4>
                    <a href="/admin/cursos">
                        Cursos
                    </a>
                </h4>
                <h4>
                    <a href="/admin/usuarios">
                        Usuarios
                    </a>
                </h4>
                <h4>
                    <a href="/admin/nuevos-afiliados">
                        Nuevos Afiliados
                    </a>
                </h4>
                <h4>
                    <a href="/admin/novedades">
                        Novedadades
                    </a>
                </h4>
                <h4>
                    <a href="/admin/asesoramiento">
                        Enlaces de Asesoramiento
                    </a>
                </h4>
            </div>
        </div>
    )
}

export default Admin;