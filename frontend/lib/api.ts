const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ACCESS_TOKEN_KEY = "shaniqua_access_token";

type AuthResponse = {
  session: { access_token: string } | null;
};

export function storeAccessToken(accessToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function signOut() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

async function postAuth(path: "signup" | "login", email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }

  return data as AuthResponse;
}

export async function signUp(email: string, password: string) {
  const data = await postAuth("signup", email, password);
  if (data.session) {
    storeAccessToken(data.session.access_token);
  }
  return data;
}

export async function logIn(email: string, password: string) {
  const data = await postAuth("login", email, password);
  if (data.session) {
    storeAccessToken(data.session.access_token);
  }
  return data;
}
