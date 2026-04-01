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
        list: (archived: boolean = false) => request<{ conversations: Conversation[] }>(`/conversations?archived=${archived}`),

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
         * Archive a conversation.
         */
        archive: (id: string) => request<{ is_archived: boolean }>(`/conversations/${id}/archive`, { method: 'POST' }),

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
         * Send a user message (supports multimodal data and web search) with real-time streaming.
         */
        stream: async (
            conversationId: string,
            content: string,
            onChunk: (data: { delta?: string; done?: boolean; userMessage?: Message; assistantMessage?: Message; error?: string }) => void,
            imageUrl?: string,
            pdfData?: string,
            isSearchEnabled?: boolean
        ) => {
            const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Note: Auth header is added automatically by the request helper, 
                    // but for fetch we need to handle it. Since request helper uses 
                    // a private function or common logic, I'll use a direct fetch here 
                    // and assume cookies/credentials handle it or add the token from localStorage.
                    'Authorization': `Bearer ${localStorage.getItem('niva_token')}`
                },
                body: JSON.stringify({ content, imageUrl, pdfData, isSearchEnabled, stream: true })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start stream');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('ReadableStream not supported');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            onChunk(data);
                        } catch (e) {
                            console.error('Failed to parse SSE chunk:', e);
                        }
                    }
                }
            }
        },

        /**
         * Send a user message (supports multimodal data and web search).
         */
        send: (conversationId: string, content: string, imageUrl?: string, pdfData?: string, isSearchEnabled?: boolean) =>
            request<{ userMessage: Message; assistantMessage: Message; wasSearched?: boolean }>(
                `/conversations/${conversationId}/messages`,
                { method: 'POST', body: { content, imageUrl, pdfData, isSearchEnabled, stream: false } }
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
        generate: (params: {
            topic?: string;
            amount?: number;
            difficulty?: 'easy' | 'medium' | 'hard';
            pdfData?: string;
            pyqData?: string;
            syllabus?: string;
            marks?: number;
        }) =>
            request<{ title: string; questions: QuizQuestion[] }>('/quiz/generate', {
                method: 'POST',
                body: params,
            }),

        /**
         * Fetch user's persistent quiz history.
         */
        getHistory: () => request<{ history: Quiz[] }>('/quiz/history'),

        /**
         * Save a completed quiz result.
         */
        save: (params: {
            title: string;
            topic: string;
            difficulty: string;
            questions: QuizQuestion[];
            score: number;
            total_questions: number;
            grade: string;
        }) =>
            request<{ quiz: Quiz }>('/quiz/save', {
                method: 'POST',
                body: params,
            }),

        /**
         * Fetch a specific quiz attempt.
         */
        getById: (id: string) => request<{ quiz: Quiz }>(`/quiz/${id}`),
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

        /**
         * Join a conversation via a shareable link ID.
         */
        joinByLink: (shareId: string) =>
            request<{ conversationId: string }>(`/conversations/join/${shareId}`, {
                method: 'POST',
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

export interface Quiz {
    id: string;
    user_id: string;
    title: string;
    topic: string;
    difficulty: string;
    questions: QuizQuestion[];
    score: number;
    total_questions: number;
    grade: string;
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
    username?: string;
    pdf_text?: string;
    created_at: string;
}

export interface QuizQuestion {
    type: 'mcq' | 'short' | 'long';
    question: string;
    options?: string[];
    correctIndex?: number;
    solution?: string;
    explanation: string;
    marks: number;
}

export interface GroupMember {
    id: string;
    username: string;
    email: string;
    role: 'owner' | 'member';
    joined_at?: string;
}
