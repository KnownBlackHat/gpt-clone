import { redirect, type Cookies, type Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const reqPath = event.url.pathname;
  const cookies = event.cookies;

  const isTokenValid = validateToken(cookies);

  if (reqPath.includes("/app")) {
    if (!isTokenValid) {
      throw redirect(303, "/login");
    }
  }

  const response = await resolve(event);
  return response;
};

async function validateToken(cookie: Cookies) {
  // TODO: write validation function
  return true;
}
