import { hfClient, getEmbeddingPipeline, supabase } from '../config';

export interface QueryResult {
    answer: string;
    sources: any[];
    confidence: number;
}

export class QueryService {
    // Token estimation (1 token ≈ 4 characters for English text)
    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    // Limit context to fit within token limits
    /**
     * Limits the size of a given context by token count and truncates content if necessary.
     * @example
     * limitContextSize([{ content: 'some text' }, { content: 'more content' }], 15000)
     * [{ content: 'some text' }, { content: 'more content truncated...' }]
     * @param {any[]} context - Array of document objects with 'content' as a property.
     * @param {number} [maxTokens=15000] - Maximum number of tokens allowed in the context.
     * @returns {any[]} Array of documents with content possibly truncated to fit within the token limit.
     */
    private limitContextSize(context: any[], maxTokens: number = 15000): any[] {
        let totalTokens = 0;
        const limitedContext: any[] = [];

        for (const doc of context) {
            const tokens = this.estimateTokens(doc.content);
            if (totalTokens + tokens <= maxTokens) {
                limitedContext.push(doc);
                totalTokens += tokens;
            } else {
                // Try to fit a truncated version
                const remainingTokens = maxTokens - totalTokens;
                if (remainingTokens > 100) { // Only if we have room for meaningful content
                    const maxChars = remainingTokens * 4;
                    const truncatedDoc = {
                        ...doc,
                        content: doc.content.substring(0, maxChars) + '...'
                    };
                    limitedContext.push(truncatedDoc);
                }
                break;
            }
        }

        return limitedContext;
    }

    /**
     * Executes a document query and returns matching results based on the query embedding and optional document name filter.
     * @example
     * queryDocuments('find this text', 'documentName')
     * Promise<QueryResult> containing relevant document chunks.
     * @param {string} query - The query string used to search for document matches.
     * @param {string=} documentName - Optional name of the document to filter the search results.
     * @returns {Promise<QueryResult>} Promise containing the matching results from the document search.
     */
    async queryDocuments(query: string, documentName?: string): Promise<QueryResult> {
        try {
            // Get query embedding
            const embeddingModel = await getEmbeddingPipeline();
            const output = await embeddingModel(query, { pooling: 'mean', normalize: true });
            const queryEmbedding = Array.from(output.data);

            // Search for relevant documents with a smaller initial limit
            const { data: matchData, error: matchError } = await supabase.rpc('match_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.20,
                match_count: documentName ? 10 : 5 // Get more results if filtering by document
            });

            if (matchError) throw matchError;

            let context = matchData || [];

            // Filter by document name if provided
            if (documentName) {
                context = context.filter((doc: any) => doc.document_name === documentName);
            }

            // Limit context size to prevent token overflow
            const limitedContext = this.limitContextSize(context, 15000);
            
            console.log(`Using ${limitedContext.length} chunks out of ${context.length} available chunks`);

            return await this.generateAnswer(query, limitedContext, documentName);
        } catch (error) {
            console.error('Error in queryDocuments:', error);
            throw error;
        }
    }

    /**
     * Generates an answer to a query using provided context and optional few-shot examples.
     * @example
     * generateAnswer("What is AI?", [{content: "AI is the simulation of human intelligence in machines."}], "intro_document")
     * Returns an object with answer, sources, and confidence score.
     * @param {string} query - The query for which an answer is to be generated.
     * @param {Array} context - An array of document objects containing content relevant to the query.
     * @param {string} [documentName] - Name of the document to fetch few-shot examples from, if available.
     * @returns {Promise<QueryResult>} A promise that resolves to an object containing the generated answer, sources of information, and a confidence score.
     */
    private async generateAnswer(query: string, context: any[], documentName?: string): Promise<QueryResult> {
        try {
            // Get few-shot examples if document name is provided (but limit their size)
            let fewShotExamples = '';
            if (documentName) {
                const { data: examplesData, error: examplesError } = await supabase
                    .from('few_shot_examples')
                    .select('few_shot_examples')
                    .eq('document_name', documentName)
                    .single();

                if (!examplesError && examplesData) {
                    // Limit few-shot examples to prevent token overflow
                    const maxExampleTokens = 3000;
                    const exampleTokens = this.estimateTokens(examplesData.few_shot_examples);
                    
                    if (exampleTokens <= maxExampleTokens) {
                        fewShotExamples = examplesData.few_shot_examples;
                    } else {
                        // Truncate examples if too long
                        const maxChars = maxExampleTokens * 4;
                        fewShotExamples = examplesData.few_shot_examples.substring(0, maxChars) + '...\n\n[Examples truncated due to length]';
                    }
                }
            }

            const contextText = context.map(doc => doc.content).join('\n\n');
            
            // Estimate total tokens for the request
            const systemPrompt = `You are a helpful assistant that answers questions based on the provided context. Do not make up information and always try to stick to the context as much as possible.
            
            ${fewShotExamples ? `Here are few-shot examples of how to answer questions:\n\n${fewShotExamples}\n\n` : ''}
            
            Guidelines:
            1. Answer based strictly on the provided context
            2. If the information is not in the context, say so clearly
            3. Be concise but comprehensive
            4. Include relevant details like numbers, dates, percentages when available
            5. If multiple sources contain relevant information, synthesize them appropriately`;

            const userMessage = `Answer the question based on the following context:\n\n${contextText}\n\nQuestion: ${query}`;
            
            const totalEstimatedTokens = this.estimateTokens(systemPrompt) + this.estimateTokens(userMessage);
            console.log(`Estimated tokens for request: ${totalEstimatedTokens}`);

            // If still too many tokens, further reduce context
            if (totalEstimatedTokens > 50000) {
                console.log('Request still too large, reducing context further...');
                const reducedContext = this.limitContextSize(context, 8000);
                const reducedContextText = reducedContext.map(doc => doc.content).join('\n\n');
                const reducedUserMessage = `Answer the question based on the following context:\n\n${reducedContextText}\n\nQuestion: ${query}`;
                
                const queryResponse = await hfClient.chatCompletion({
                    model: "openai/gpt-oss-120b",
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt,
                        },
                        {
                            role: "user",
                            content: reducedUserMessage
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7,
                });

                const answer = queryResponse.choices[0].message.content ?? "I couldn't generate an answer.";
                const confidence = this.calculateConfidence(reducedContext, query);

                return {
                    answer,
                    sources: reducedContext.map(doc => ({
                        content: doc.content.substring(0, 200) + '...',
                        document_name: doc.document_name || 'Unknown',
                        chunk_index: doc.chunk_index || 0,
                        similarity: doc.similarity || 0
                    })),
                    confidence
                };
            }

            const queryResponse = await hfClient.chatCompletion({
                model: "openai/gpt-oss-120b",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt,
                    },
                    {
                        role: "user",
                        content: userMessage
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7,
            });

            const answer = queryResponse.choices[0].message.content ?? "I couldn't generate an answer.";
            
            // Calculate confidence based on context relevance
            const confidence = this.calculateConfidence(context, query);

            return {
                answer,
                sources: context.map(doc => ({
                    content: doc.content.substring(0, 200) + '...',
                    document_name: doc.document_name || 'Unknown',
                    chunk_index: doc.chunk_index || 0,
                    similarity: doc.similarity || 0
                })),
                confidence
            };
        } catch (error) {
            console.error('Error generating answer:', error);
            throw error;
        }
    }

    /**
     * Calculates the confidence level of a query based on the context provided.
     * @example
     * calculateConfidence([{similarity: 0.8, content: 'text'}, {similarity: 0.6, content: 'more text'}], 'search query')
     * // Returns 0.75
     * @param {Array<object>} context - An array of context objects containing similarity scores and content length information.
     * @param {string} query - The query string for which the confidence level is calculated.
     * @returns {number} The calculated confidence score rounded to two decimal places.
     */
    private calculateConfidence(context: any[], query: string): number {
        if (!context || context.length === 0) return 0;

        // Simple confidence calculation based on:
        // 1. Number of relevant sources
        // 2. Average similarity score
        // 3. Content length
        
        const avgSimilarity = context.reduce((sum, doc) => sum + (doc.similarity || 0.5), 0) / context.length;
        const sourceCount = Math.min(context.length / 5, 1); // Normalize to 0-1
        const avgContentLength = context.reduce((sum, doc) => sum + doc.content.length, 0) / context.length;
        const contentScore = Math.min(avgContentLength / 1000, 1); // Normalize to 0-1

        // Weighted average
        const confidence = (avgSimilarity * 0.5) + (sourceCount * 0.3) + (contentScore * 0.2);
        
        return Math.round(confidence * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Searches for chunks similar to the given query within specified documents.
     * @example
     * searchSimilarChunks("example query", "Document1", 5)
     * Returns an array of matching document chunks.
     * @param {string} query - The query string to search for similar chunks.
     * @param {string} [documentName] - Optional name of the document to filter results.
     * @param {number} [limit=5] - The maximum number of similar chunks to return.
     * @returns {Promise<any[]>} A promise that resolves to an array of similar chunks.
     */
    async searchSimilarChunks(query: string, documentName?: string, limit: number = 5): Promise<any[]> {
        try {
            // Use local embedding model instead of OpenAI
            const embeddingModel = await getEmbeddingPipeline();
            const output = await embeddingModel(query, { pooling: 'mean', normalize: true });
            const queryEmbedding = Array.from(output.data);

            let searchQuery = supabase.rpc('match_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.30,
                match_count: limit
            });

            const { data, error } = await searchQuery;
            if (error) throw error;

            // Filter by document name if provided
            if (documentName) {
                return (data || []).filter((doc: any) => doc.document_name === documentName);
            }

            return data || [];
        } catch (error) {
            console.error('Error searching similar chunks:', error);
            throw error;
        }
    }
}
