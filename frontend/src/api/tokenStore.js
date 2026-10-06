// The access token lives only in this variable: never in localStorage.
// (If an attacker injects a script into the page, localStorage is readable. This variable is much harder to reach.)
let accessToken = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token;
};