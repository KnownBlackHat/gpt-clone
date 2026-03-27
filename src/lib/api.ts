const API_BASE = import.meta.env.VITE_API_BASE || '/api';

interface RequestOptions {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const config: RequestInit = {
        method,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data as T;
}

// Auth
export const api = {
    auth: {
        signup: (username: string, email: string, password: string) =>
            request('/auth/signup', { method: 'POST', body: { username, email, password } }),
        login: (email: string, password: string) =>
            request('/auth/login', { method: 'POST', body: { email, password } }),
        logout: () => request('/auth/logout', { method: 'POST' }),
        me: () => request<{ user: User }>('/auth/me'),
    },
    conversations: {
        list: () => request<{ conversations: Conversation[] }>('/conversations'),
        create: (title?: string, category?: string) =>
            request<{ conversation: Conversation }>('/conversations', { method: 'POST', body: { title, category } }),
        get: (id: string) => request<{ conversation: Conversation }>(`/conversations/${id}`),
        delete: (id: string) => request(`/conversations/${id}`, { method: 'DELETE' }),
    },
    messages: {
        list: (conversationId: string) =>
            request<{ messages: Message[] }>(`/conversations/${conversationId}/messages`),
        send: (conversationId: string, content: string, imageUrl?: string, pdfData?: string, isSearchEnabled?: boolean) =>
            request<{ userMessage: Message; assistantMessage: Message; wasSearched?: boolean }>(
                `/conversations/${conversationId}/messages`,
                { method: 'POST', body: { content, imageUrl, pdfData, isSearchEnabled } }
            ),
    },
    user: {
        get: () => request<{ user: User }>('/user'),
        update: (data: Partial<User & { currentPassword?: string; newPassword?: string }>) =>
            request<{ user: User }>('/user', { method: 'PUT', body: data }),
        delete: () => request('/user', { method: 'DELETE' }),
    },
};

// Types
export interface User {
    id: string;
    username: string;
    email: string;
    plan: string;
    avatar_url: string | null;
    created_at: string;
}

export interface Conversation {
    id: string;
    title: string;
    category: string;
    created_at: string;
    updated_at: string;
    last_message?: string;
    message_count?: number;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    image_url?: string;
    created_at: string;
}
