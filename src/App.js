import React from 'react';
import { Provider } from 'react-redux';
import store from './redux/store';
import AppRouter from './routes/Routes';
import "primereact/resources/themes/nova-accent/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

function App() {
    return (
        <Provider
            store={store}
        >
            <AppRouter></AppRouter>
        </Provider>
    );
}

export default App;
