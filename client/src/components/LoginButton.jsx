import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export default function LoginButton() {
  const { loginWithRedirect, isLoading } = useAuth0();
  return (
    <button
      disabled={isLoading}
      onClick={() =>
        loginWithRedirect({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            scope: 'openid profile email offline_access',
          },
        })
      }
      className='px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:brightness-110 active:scale-[.98]'
    >
      Iniciar sesión
    </button>
  );
}
// Botón de inicio de sesión que utiliza Auth0