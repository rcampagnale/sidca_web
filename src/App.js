import React from 'react';
import { Provider } from 'react-redux';
import store from './redux/store';
import AppRouter from './routes/Routes';
import "primereact/resources/themes/saga-orange/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import SetUser from './components/SetUser/setUser';

function App() {
    return (
        <Provider
            store={store}
        >
            <SetUser>
                <AppRouter></AppRouter>
            </SetUser>
        </Provider>
    );
}

export default App;
