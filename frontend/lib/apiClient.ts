import { apiResult } from "@/types/api/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<apiResult<T>> {

    try {
        //add credentials or options if needed
        const res = await fetch(`${BASE_URL}/${path}`,
             {...options});

        const status = res.status;

        if (!res.ok) {
            const errorText = await res.text();
            return {
                payload: null,
                error: `Error ${status}: ${errorText}`,
                status,
            };
        }

        const data = (await res.json()) as T;

        return {
            payload: data,
            error: null,
            status,
        };

        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Network error while calling the backend';
        return {
            payload: null,
            error: errorMessage,
            status: null,
        };
        
    }


}