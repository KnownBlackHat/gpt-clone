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
        // signup tbh this could use better validation
        signup: (username: string, email: string, password: string) =>
            request('/auth/signup', { method: 'POST', body: { username, email, password } }),

        // login
        login: (email: string, password: string) =>
            request('/auth/login', { method: 'POST', body: { email, password } }),

        
        logout: () => request('/auth/logout', { method: 'POST' }),

        
        me: () => request<{ user: User }>('/auth/me'),
    },

    conversations: {
        // list convos
        list: (archived: boolean = false) => request<{ conversations: Conversation[] }>(`/conversations?archived=${archived}`),

        // new chat
        create: (title?: string, category?: string) =>
            request<{ conversation: Conversation }>('/conversations', { method: 'POST', body: { title, category } }),

        
        get: (id: string) => request<{ conversation: Conversation }>(`/conversations/${id}`),

        
        delete: (id: string) => request(`/conversations/${id}`, { method: 'DELETE' }),

        
        archive: (id: string) => request<{ is_archived: boolean }>(`/conversations/${id}/archive`, { method: 'POST' }),

        
        share: (id: string) => request<{ shareId: string }>(`/conversations/${id}/share`, { method: 'POST' }),

        
        rename: (id: string, title: string) =>
            request<{ conversation: any }>(`/conversations/${id}`, {
                method: 'PUT',
                body: { title },
            }),

        
        updateCategory: (id: string, category: string) =>
            request<{ conversation: any }>(`/conversations/${id}`, {
                method: 'PUT',
                body: { category },
            }),
    },

    messages: {
        // get msgs
        list: (conversationId: string) =>
            request<{ messages: Message[] }>(`/conversations/${conversationId}/messages`),

        
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

            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Keep the last segment in the buffer as it might be incomplete
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            onChunk(data);
                        } catch (e) {
                            console.error('Failed to parse SSE chunk:', e, trimmed);
                        }
                    }
                }
            }
        },

        
        send: (conversationId: string, content: string, imageUrl?: string, pdfData?: string, isSearchEnabled?: boolean) =>
            request<{ userMessage: Message; assistantMessage: Message; wasSearched?: boolean }>(
                `/conversations/${conversationId}/messages`,
                { method: 'POST', body: { content, imageUrl, pdfData, isSearchEnabled, stream: false } }
            ),

        
        edit: (messageId: string, content: string) =>
            request<{ message: Message; needsResend: boolean }>(`/messages/${messageId}`, {
                method: 'PUT',
                body: { content },
            }),

        
        retry: (messageId: string) =>
            request<{ userMessage: Message; needsResend: boolean }>(`/messages/${messageId}/retry`, {
                method: 'POST',
            }),
    },

    user: {
        
        get: () => request<{ user: User }>('/user'),

        
        update: (data: Partial<User & { currentPassword?: string; newPassword?: string }>) =>
            request<{ user: User }>('/user', { method: 'PUT', body: data }),

        
        deleteAccount: () => request('/user', { method: 'DELETE' }),
    },

    public: {
        
        getShared: (shareId: string) =>
            request<{ conversation: any; messages: Message[] }>(`/public/share/${shareId}`),
    },

    quiz: {
        // make quiz
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

        
        getHistory: () => request<{ history: Quiz[] }>('/quiz/history'),

        
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

        
        getById: (id: string) => request<{ quiz: Quiz }>(`/quiz/${id}`),
    },

    groupChat: {
        
        createGroup: (title: string, memberEmails: string[] = []) =>
            request<{ conversation: Conversation; members: GroupMember[] }>('/conversations/group', {
                method: 'POST',
                body: { title, memberEmails },
            }),

        
        members: (conversationId: string) =>
            request<{ members: GroupMember[] }>(`/conversations/${conversationId}/members`),

        
        addMember: (conversationId: string, email: string) =>
            request<{ member: GroupMember }>(`/conversations/${conversationId}/members`, {
                method: 'POST',
                body: { email },
            }),

        
        removeMember: (conversationId: string, memberId: string) =>
            request(`/conversations/${conversationId}/members/${memberId}`, {
                method: 'DELETE',
            }),

        
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
    is_archived?: boolean;
    user_id?: string;
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
