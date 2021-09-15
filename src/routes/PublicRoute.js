// import React from 'react';
// import { Route } from 'react-router-dom';
// import PublicLayout from 'components/PublicLayout/PublicLayout';

// const ignoreLayout = [
//     '/login',
//     '/logout'
// ]

// const PublicRoute = ({ component: Component, ...rest }) => {
//     return (
//         <Route {...rest} render={props => (
//             ignoreLayout.includes(rest.location.pathname) ?
//                 <Component {...props} />
//                 :
//                 <PublicLayout>
//                     <Component {...props} />
//                 </PublicLayout>
//         )} />                          
//     )
// }

// export default PublicRoute;