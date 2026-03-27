import { redirect, type Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
    const reqPath = event.url.pathname;

    // Protected routes under /chat and /settings
    if (reqPath.startsWith("/chat") || reqPath.startsWith("/settings") || reqPath.startsWith("/saved")) {
        const token = event.cookies.get("token");
        if (!token) {
            throw redirect(303, "/login");
        }
    }

    // If user has token and is on auth pages, redirect to chat
    if (reqPath.startsWith("/login") || reqPath.startsWith("/signup")) {
        const token = event.cookies.get("token");
        if (token) {
            throw redirect(303, "/chat");
        }
    }

    const response = await resolve(event);
    return response;
};
