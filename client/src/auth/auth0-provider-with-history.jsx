import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';


const Auth0ProviderWithHistory = ({ children }) => {
const navigate = useNavigate();
const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;


const onRedirectCallback = (appState) => {
navigate(appState?.returnTo || window.location.pathname);
};


if (!(domain && clientId && audience)) return <div>Configura Auth0…</div>;


return (
<Auth0Provider
domain={domain}
clientId={clientId}
authorizationParams={{
redirect_uri: window.location.origin,
audience,
}}
onRedirectCallback={onRedirectCallback}
cacheLocation="localstorage"
useRefreshTokens
>
{children}
</Auth0Provider>
);
};


export default Auth0ProviderWithHistory;