import { writable } from 'svelte/store';

export type AlertType = 'info' | 'success' | 'error' | 'confirm';

interface Toast {
    id: string;
    message: string;
    type: AlertType;
}

interface AlertState {
    show: boolean;
    type: AlertType | 'prompt' | 'select';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    placeholder?: string;
    promptValue?: string;
    options?: { label: string; value: string }[];
    resolve?: (value: any) => void;
    toasts: Toast[];
}

const initialState: AlertState = {
    show: false,
    type: 'info',
    title: '',
    message: '',
    toasts: [],
};

function createUIStore() {
    const { subscribe, set, update } = writable<AlertState>(initialState);

    return {
        subscribe,
        alert: (message: string, title = 'Alert', type: AlertType = 'info') => {
            return new Promise<boolean>((resolve) => {
                update(s => ({
                    ...s,
                    show: true,
                    type,
                    title,
                    message,
                    confirmText: 'OK',
                    resolve,
                }));
            });
        },
        confirm: (message: string, title = 'Confirm Action', confirmText = 'Confirm', cancelText = 'Cancel') => {
            return new Promise<boolean>((resolve) => {
                update(s => ({
                    ...s,
                    show: true,
                    type: 'confirm',
                    title,
                    message,
                    confirmText,
                    cancelText,
                    resolve,
                }));
            });
        },
        prompt: (message: string, title = 'Input Required', defaultValue = '', placeholder = 'Enter value...') => {
            return new Promise<string | null>((resolve) => {
                update(s => ({
                    ...s,
                    show: true,
                    type: 'prompt',
                    title,
                    message,
                    promptValue: defaultValue,
                    placeholder,
                    confirmText: 'Submit',
                    cancelText: 'Cancel',
                    resolve,
                }));
            });
        },
        select: (message: string, options: { label: string; value: string }[], title = 'Select Option') => {
            return new Promise<string | null>((resolve) => {
                update(s => ({
                    ...s,
                    show: true,
                    type: 'select',
                    title,
                    message,
                    options,
                    cancelText: 'Cancel',
                    resolve,
                }));
            });
        },
        toast: (message: string, type: AlertType = 'info') => {
            const id = Math.random().toString(36).substring(2, 9);
            update(s => ({
                ...s,
                toasts: [...s.toasts, { id, message, type }]
            }));
            setTimeout(() => {
                update(s => ({
                    ...s,
                    toasts: s.toasts.filter(t => t.id !== id)
                }));
            }, 3000);
        },
        close: (result: any) => {
            update((state) => {
                if (state.resolve) state.resolve(result);
                return { ...state, show: false, resolve: undefined, promptValue: undefined };
            });
        },
        setPromptValue: (val: string) => {
            update(s => ({ ...s, promptValue: val }));
        }
    };
}

export const ui = createUIStore();
