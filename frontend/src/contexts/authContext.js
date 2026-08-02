import {
  createContext,
  useContext,
} from "react";

/*
|--------------------------------------------------------------------------
| Auth context
|--------------------------------------------------------------------------
|
| The context object and its hook live apart from the provider component so
| that AuthProvider.jsx exports nothing but a component. A module that
| mixes components with other exports cannot be hot-reloaded on its own, so
| every edit to the provider forced a full page reload — and with it a lost
| form, a lost scroll position, and a re-fetch of everything on screen.
|
*/

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
