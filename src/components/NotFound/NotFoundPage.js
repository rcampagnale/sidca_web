import React from 'react'

export const NotFoundPage = ({ history }) => {
    return (
        <div>
            <div>
                <h2><b>404 Not Found</b></h2>
                <h1><b>Ups! Página no existente</b></h1>
                <hr />
                <h2>Por favor verifique la dirección ingresada</h2>
                <button
                    onClick={() => (
                        history.goBack()
                    )}
                >
                    Volver
                </button>
            </div>
        </div>
    )
}
