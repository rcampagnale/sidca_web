import React from 'react';
import { Provider } from 'react-redux';
import store from './redux/store';
import AppRouter from './routes/Routes';
import "primereact/resources/themes/saga-orange/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import SetUser from './components/SetUser/setUser';
import AdminSessionGuard from './components/AdminSession/AdminSessionGuard';
import { ConfirmDialog } from 'primereact/confirmdialog'; // <- contenedor global

function App() {
  return (
    <Provider store={store}>
      <>
        {/* Cierra la sesión administrativa tras 5 h de inactividad.
            No afecta al usuario que ingresa por DNI. */}
        <AdminSessionGuard />

        <SetUser>
          <AppRouter />
        </SetUser>

        {/* Montado una sola vez en toda la app */}
        <ConfirmDialog />
      </>
    </Provider>
  );
}

export default App;

