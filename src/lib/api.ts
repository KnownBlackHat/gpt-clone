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

// Auth & Account APIs
export const api = {
    auth: {
        /**
         * Create a new user account.
         * Note: this will also set the 'token' cookie via the backend.
         */
        signup: (username: string, email: string, password: string) =>
            request('/auth/signup', { method: 'POST', body: { username, email, password } }),

        /**
         * Authenticate existing user.
         */
        login: (email: string, password: string) =>
            request('/auth/login', { method: 'POST', body: { email, password } }),

        /**
         * Clear session (removes auth cookie).
         */
        logout: () => request('/auth/logout', { method: 'POST' }),

        /**
         * Verify current session and return user data.
         */
        me: () => request<{ user: User }>('/auth/me'),
    },

    conversations: {
        /**
         * List all chats for the current user.
         */
        list: () => request<{ conversations: Conversation[] }>('/conversations'),

        /**
         * Start a new chat session.
         */
        create: (title?: string, category?: string) =>
            request<{ conversation: Conversation }>('/conversations', { method: 'POST', body: { title, category } }),

        /**
         * Fetch a specific conversation by ID.
         */
        get: (id: string) => request<{ conversation: Conversation }>(`/conversations/${id}`),

        /**
         * Delete an entire conversation thread.
         */
        delete: (id: string) => request(`/conversations/${id}`, { method: 'DELETE' }),
    },

    messages: {
        /**
         * Fetch message history for a chat.
         */
        list: (conversationId: string) =>
            request<{ messages: Message[] }>(`/conversations/${conversationId}/messages`),

        /**
         * Send a user message (supports multimodal data and web search).
         */
        send: (conversationId: string, content: string, imageUrl?: string, pdfData?: string, isSearchEnabled?: boolean) =>
            request<{ userMessage: Message; assistantMessage: Message; wasSearched?: boolean }>(
                `/conversations/${conversationId}/messages`,
                { method: 'POST', body: { content, imageUrl, pdfData, isSearchEnabled } }
            ),
    },

    user: {
        /**
         * Fetch full user profile data.
         */
        get: () => request<{ user: User }>('/user'),

        /**
         * Update profile or password.
         */
        update: (data: Partial<User & { currentPassword?: string; newPassword?: string }>) =>
            request<{ user: User }>('/user', { method: 'PUT', body: data }),

        /**
         * Permanent account deletion. Use with caution.
         */
        deleteAccount: () => request('/user', { method: 'DELETE' }),
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
