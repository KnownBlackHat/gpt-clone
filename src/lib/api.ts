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

        /**
         * Generate a public share link for a conversation.
         */
        share: (id: string) => request<{ shareId: string }>(`/conversations/${id}/share`, { method: 'POST' }),

        /**
         * Rename a conversation.
         */
        rename: (id: string, title: string) =>
            request<{ conversation: any }>(`/conversations/${id}`, {
                method: 'PUT',
                body: { title },
            }),
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

        /**
         * Update an existing message (usually for editing).
         */
        edit: (messageId: string, content: string) =>
            request<{ message: Message; needsResend: boolean }>(`/messages/${messageId}`, {
                method: 'PUT',
                body: { content },
            }),

        /**
         * Regenerate an assistant response.
         */
        retry: (messageId: string) =>
            request<{ userMessage: Message; needsResend: boolean }>(`/messages/${messageId}/retry`, {
                method: 'POST',
            }),
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

    public: {
        /**
         * Fetch a shared conversation by its share ID.
         */
        getShared: (shareId: string) =>
            request<{ conversation: any; messages: Message[] }>(`/public/share/${shareId}`),
    },

    quiz: {
        /**
         * Generate a quiz based on a topic.
         */
        generate: (topic: string, amount: number, difficulty: 'easy' | 'medium' | 'hard' = 'medium') =>
            request<{ title: string; questions: QuizQuestion[] }>('/quiz/generate', {
                method: 'POST',
                body: { topic, amount, difficulty },
            }),
    },

    groupChat: {
        /**
         * Create a new group conversation with optional initial members.
         */
        createGroup: (title: string, memberEmails: string[] = []) =>
            request<{ conversation: Conversation; members: GroupMember[] }>('/conversations/group', {
                method: 'POST',
                body: { title, memberEmails },
            }),

        /**
         * List all members of a group conversation.
         */
        members: (conversationId: string) =>
            request<{ members: GroupMember[] }>(`/conversations/${conversationId}/members`),

        /**
         * Invite a user to a group conversation by email.
         */
        addMember: (conversationId: string, email: string) =>
            request<{ member: GroupMember }>(`/conversations/${conversationId}/members`, {
                method: 'POST',
                body: { email },
            }),

        /**
         * Remove a member from a group conversation.
         */
        removeMember: (conversationId: string, memberId: string) =>
            request(`/conversations/${conversationId}/members/${memberId}`, {
                method: 'DELETE',
            }),
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
    is_group?: boolean;
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

export interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

export interface GroupMember {
    id: string;
    username: string;
    email: string;
    role: 'owner' | 'member';
    joined_at?: string;
}
