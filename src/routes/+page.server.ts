import {redirect} from "@sveltejs/kit";

export async function load({cookies}: {cookies: CookieStore}) {
    const cookie = await cookies.get("authToken");

    if (cookie) {
        throw redirect(303, "/chat")
    } else {
        throw redirect(303, "/login")
    }
}
