import { redirect, type Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
    const reqPath = event.url.pathname;

    // Proxy /api requests to the backend
    if (reqPath.startsWith("/api")) {
        const backendUrl = `http://api:3001${reqPath}${event.url.search}`;
        const headers = new Headers(event.request.headers);
        // We might want to remove some host headers if needed
        headers.delete('host');

        try {
            const response = await fetch(backendUrl, {
                method: event.request.method,
                headers,
                body: event.request.method !== 'GET' ? await event.request.arrayBuffer() : undefined,
                duplex: 'half'
            } as any);

            return response;
        } catch (error) {
            console.error('API Proxy error:', error);
            return new Response(JSON.stringify({ error: 'Gateway Error' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
        }
    }

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
