// API configuration and utilities
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// API client with error handling
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Sends an HTTP request to a specified endpoint and returns the parsed JSON response.
   * @example
   * request('/api/data', { method: 'GET' })
   * // Returns the parsed JSON data from the response
   * @template T
   * @param {string} endpoint - The API endpoint to send the request to.
   * @param {RequestInit} [options={}] - Optional configurations for the request, such as headers and method.
   * @returns {Promise<T>} A promise that resolves to the parsed JSON response of type T.
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  // Health check
  async checkHealth() {
    return this.request('/health');
  }

  // Document operations
  async getDocuments(): Promise<{ documents: Document[]; total: number }> {
    return this.request('/api/documents');
  }

  async processExistingDocument(fileName: string): Promise<any> {
    return this.request('/api/documents/process', {
      method: 'POST',
      body: JSON.stringify({ fileName }),
    });
  }

  async uploadDocument(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('pdf', file);
    
    return this.request('/api/documents/upload', {
      method: 'POST',
      headers: {}, // Remove Content-Type for FormData
      body: formData,
    });
  }

  async deleteDocument(documentName: string): Promise<any> {
    return this.request(`/api/documents/${encodeURIComponent(documentName)}`, {
      method: 'DELETE',
    });
  }

  // Query operations
  async queryDocuments(query: string, documentName?: string): Promise<QueryResult> {
    return this.request('/api/query', {
      method: 'POST',
      body: JSON.stringify({ query, documentName }),
    });
  }

  async searchSimilarChunks(query: string, documentName?: string, limit: number = 5): Promise<{ results: SearchResult[]; total: number }> {
    return this.request('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query, documentName, limit }),
    });
  }

  // Few-shot examples
  async getFewShotExamples(documentName: string): Promise<{ fewShotExamples: string }> {
    return this.request(`/api/documents/${encodeURIComponent(documentName)}/examples`);
  }

  // Statistics
  async getStats(): Promise<{ stats: Stats }> {
    return this.request('/api/stats');
  }
}

// Default client instance
export const apiClient = new ApiClient();

// Type definitions
export interface Document {
  name: string;
  created_at: string;
  chunk_count: number;
}

export interface QueryResult {
  answer: string;
  sources: SearchResult[];
  confidence: number;
}

export interface SearchResult {
  content: string;
  document_name: string;
  chunk_index: number;
  similarity: number;
}

export interface Stats {
  totalDocuments: number;
  totalChunks: number;
  averageChunkSize: number;
  documentsWithExamples: number;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
}
