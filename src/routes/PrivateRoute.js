// import React, { useEffect } from 'react';
// import { Route } from 'react-router-dom';
// import { AuthProvider } from 'oidc-react';
// import PrivateLayout from 'components/PrivateLayout/PrivateLayout';
// // import { auth } from 'api';

// const ignoreLayout = [
//     '/login',
//     '/logout'
// ]

// const logoutFromAuth = async () => {
//     const access_token = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).access_token : undefined;
//     await auth.logout_from_server(access_token).then(
//         response => {
//             //console.log(response);
//         }
//     ).catch(
//         error => {
//             console.log(error);
//             //alert('No se pudo cerrar la sesión en auth.catamarca.gob.ar');
//         }
//     );
//     window.location.href = process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/` : '/';
// }

// const oidcConfig = {
//     onSignIn: async (user) => {
//         const next = sessionStorage.getItem('next')
//         localStorage.setItem('user', JSON.stringify(
//             {
//                 user_id: user.profile.sub,
//                 access_token: user.access_token,
//                 id_token: user.id_token,
//                 refresh_token: user.refresh_token
//             }
//         ));
//         window.location.href = process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}${next || "/perfil"}` : `${next || "/perfil"}`  ;
//     },
//     onSignOut: async () => {
//         logoutFromAuth();
//     },
//     authority: process.env.REACT_APP_OIDC_AUTHORITY_URL,
//     clientId: process.env.REACT_APP_OIDC_CLIENT_ID,
//     redirectUri: process.env.REACT_APP_OIDC_REDIRECT_URI,
//     clientSecret: process.env.REACT_APP_OIDC_CLIENT_SECRET,
//     responseType: 'code',
//     scope: 'openid profile email'
// };

// const PrivateRoute = ({ component: Component, ...rest }) => {
//     if (rest.location.pathname != '/login'){
//         if(rest.location.pathname.includes(":step")){
//             sessionStorage.setItem('next', "/curriculum-vitae/perfil")
//         }else{

//             sessionStorage.setItem('next', rest.location.pathname)
//         }
//     }
//     return (
//         <AuthProvider {...oidcConfig}>
//             <Route {...rest} render={props => (
//                 ignoreLayout.includes(rest.location.pathname) ?
//                     <Component {...props} />
//                     :
//                     <PrivateLayout>
//                         <Component {...props} />
//                     </PrivateLayout>
//             )} />
//         </AuthProvider>
//     )
// }

// export default PrivateRoute;