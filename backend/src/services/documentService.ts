import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { hfClient, getEmbeddingPipeline, supabase } from '../config';

export interface ProcessDocumentResult {
    chunksProcessed: number;
    fewShotExamplesGenerated: boolean;
}

export interface DocumentInfo {
    id: string;
    document_name: string;
    created_at: string;
    chunk_count: number;
}

export class DocumentService {
    private textSplitter: RecursiveCharacterTextSplitter;

    constructor() {
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 12000,
            chunkOverlap: 1500,
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    private splitTextForTokenLimit(text: string, maxTokens: number): string[] {
        const maxChars = maxTokens * 4;
        const chunks: string[] = [];
        
        for (let i = 0; i < text.length; i += maxChars) {
            chunks.push(text.slice(i, i + maxChars));
        }
        
        return chunks;
    }

    /**
     * Processes a PDF document to extract embeddings and generate few-shot examples, ensuring the document is not already processed.
     * @example
     * processDocument("pdfContentString", "exampleDocumentName", "/path/to/file")
     * Promise<ProcessDocumentResult>
     * @param {string} pdfContent - The content of the PDF document to be processed.
     * @param {string} documentName - The name of the document to check for existing processing and usage in operations.
     * @param {string} filePath - The file path where the document resides.
     * @returns {Promise<ProcessDocumentResult>} A promise that resolves to an object containing the number of chunks processed and a boolean indicating if few-shot examples were generated.
     */
    async processDocument(pdfContent: string, documentName: string, filePath: string): Promise<ProcessDocumentResult> {
        try {
            // Check if document already exists
            const existingDoc = await this.checkDocumentExists(documentName);
            if (existingDoc) {
                console.log(`Document ${documentName} already processed. Skipping.`);
                return {
                    chunksProcessed: existingDoc.chunk_count,
                    fewShotExamplesGenerated: true
                };
            }

            // Process embeddings
            const chunksProcessed = await this.processEmbeddings(pdfContent, documentName);
            
            // Generate few-shot examples
            const fewShotExamplesGenerated = await this.generateFewShotExamples(pdfContent, documentName);

            return {
                chunksProcessed,
                fewShotExamplesGenerated
            };
        } catch (error) {
            console.error('Error in processDocument:', error);
            throw error;
        }
    }

    /**
     * Checks if a document exists in the database, returning its information if found.
     * @example
     * checkDocumentExists('sampleDocument')
     * // Returns DocumentInfo object or null if not found
     * @param {string} documentName - The name of the document to check for existence.
     * @returns {Promise<DocumentInfo | null>} Returns a promise that resolves to the document's information or null if not found.
     */
    private async checkDocumentExists(documentName: string): Promise<DocumentInfo | null> {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('document_name', documentName)
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                // Count chunks for this document
                const { count } = await supabase
                    .from('documents')
                    .select('*', { count: 'exact', head: true })
                    .eq('document_name', documentName);

                return {
                    id: data[0].id,
                    document_name: data[0].document_name,
                    created_at: data[0].created_at,
                    chunk_count: count || 0
                };
            }

            return null;
        } catch (error) {
            console.error('Error checking document existence:', error);
            return null;
        }
    }

    /**
     * Processes text chunks from a PDF and stores their embeddings in a database.
     * @example
     * processEmbeddings("Sample PDF text content", "ExampleDocument")
     * // Returns number of successfully processed chunks, e.g., 10
     * @param {string} pdfContent - The content of the PDF to be processed as a single string.
     * @param {string} documentName - The name of the document to associate with the embeddings.
     * @returns {Promise<number>} Number of successfully processed text chunks.
     */
    private async processEmbeddings(pdfContent: string, documentName: string): Promise<number> {
        const chunks = await this.textSplitter.splitText(pdfContent);
        const batchSize = 2;
        const delayBetweenBatches = 8000;
        let totalProcessed = 0;

        console.log(`Processing ${chunks.length} chunks in batches of ${batchSize}...`);

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}...`);

            try {
                const batchResults = await Promise.all(
                    batch.map(async (chunk, index) => {
                        const embeddingModel = await getEmbeddingPipeline();
                        const output = await embeddingModel(chunk, { pooling: 'mean', normalize: true });
                        const embedding = Array.from(output.data);

                        const { error } = await supabase.from('documents').insert({
                            content: chunk,
                            embedding: embedding,
                            document_name: documentName,
                            chunk_index: i + index,
                            created_at: new Date().toISOString()
                        });

                        if (error) throw error;

                        return {
                            chunk: chunk,
                            embedding: embedding,
                        };
                    })
                );

                totalProcessed += batchResults.length;

                // Delay between batches
                if (i + batchSize < chunks.length) {
                    console.log(`Waiting ${delayBetweenBatches / 1000} seconds before next batch...`);
                    await this.delay(delayBetweenBatches);
                }

            } catch (error: any) {
                if (error.code === 'rate_limit_exceeded') {
                    console.log('Rate limit hit. Waiting 60 seconds...');
                    await this.delay(60000);
                    i -= batchSize; // Retry the same batch
                } else {
                    console.error('Error processing batch:', error);
                    throw error;
                }
            }
        }

        return totalProcessed;
    }

    /**
     * Generates few-shot examples for a given document and stores them in the database.
     * @example
     * generateFewShotExamples('PDF content here', 'document123')
     * // Returns true if few-shot examples are successfully generated or already exist.
     * @param {string} pdfContent - The content of the PDF document as a string.
     * @param {string} documentName - The name or identifier of the document.
     * @returns {Promise<boolean>} Returns a promise that resolves to true if examples are generated or found, false if an error occurs.
     */
    private async generateFewShotExamples(pdfContent: string, documentName: string): Promise<boolean> {
        try {
            // Check if few-shot examples already exist
            const existingExamples = await this.getFewShotExamplesFromDB(documentName);
            
            if (existingExamples) {
                console.log(`Found existing few-shot examples for ${documentName}.`);
                return true;
            }

            console.log(`Generating few-shot examples for ${documentName}...`);
            
            const maxInputTokens = 25000;
            const estimatedTokens = this.estimateTokens(pdfContent);
            
            let fewShotExamples: string;
            
            if (estimatedTokens <= maxInputTokens) {
                fewShotExamples = await this.processSingleChunkForExamples(pdfContent);
            } else {
                const chunks = this.splitTextForTokenLimit(pdfContent, maxInputTokens);
                console.log(`Splitting document into ${chunks.length} chunks for few-shot example generation...`);
                
                const allExamples: string[] = [];
                
                for (let i = 0; i < chunks.length; i++) {
                    try {
                        const examples = await this.processSingleChunkForExamples(chunks[i], i + 1);
                        allExamples.push(examples);
                        
                        if (i < chunks.length - 1) {
                            await this.delay(5000);
                        }
                        
                    } catch (error: any) {
                        if (error.code === 'rate_limit_exceeded') {
                            console.log(`Rate limit hit on chunk ${i + 1}. Waiting 60 seconds...`);
                            await this.delay(60000);
                            i--; // Retry the same chunk
                        } else {
                            console.error(`Error processing chunk ${i + 1}:`, error);
                        }
                    }
                }
                
                fewShotExamples = allExamples.join('\n\n');
            }

            // Store the generated examples
            await this.storeFewShotExamplesInDB(documentName, fewShotExamples);
            
            return true;
        } catch (error) {
            console.error('Error generating few-shot examples:', error);
            return false;
        }
    }

    /**
     * Processes a single document chunk to generate realistic query-answer pairs for use as training examples.
     * @example
     * processSingleChunkForExamples("Sample document content", 2)
     * // Returns query-answer pairs for the specified document content chunk.
     * @param {string} content - The content of the document chunk to process.
     * @param {number} [chunkNumber] - The optional chunk number indicating a specific section of a larger document.
     * @returns {Promise<string>} A promise resolving to a string containing 3-5 query-answer pairs based on the analyzed document content.
     */
    private async processSingleChunkForExamples(content: string, chunkNumber?: number): Promise<string> {
        const response = await hfClient.chatCompletion({
            model: "openai/gpt-oss-120b",
            messages: [
                {
                    role: "system",
                    content: `You are an expert document analyzer specializing in creating high-quality training examples. Your task is to generate 3-5 realistic query-answer pairs from the provided document content that can be used as few-shot examples for training other AI models.

                    **Instructions:**
                    1. Carefully analyze the provided document content to understand its structure, key topics, and information
                    2. Generate 3-5 diverse query-answer pairs that cover different aspects and sections of the document content
                    3. Ensure queries are realistic and represent actual questions someone might ask about the document
                    4. Provide accurate, concise answers based strictly on the document content
                    5. Cover various information types: definitions, procedures, requirements, limitations, benefits, etc.
                    6. Make queries specific and practical (include relevant scenarios, examples, or context when appropriate)
                    7. Ensure answers are definitive and reference specific document sections or terms when applicable

                    **Output Format:**
                    For each example, use this exact structure:

                    Sample Query: [Write a realistic question about the document content]
                    Sample Answer: [Provide accurate answer based on document content]

                    **Query Types to Include:**
                    - Specific feature/benefit verification questions
                    - Process and procedure inquiries
                    - Requirement clarifications
                    - Limitation and restriction questions
                    - Timeline and duration queries
                    - Eligibility and qualification criteria
                    - Cost, fee, or numeric value questions
                    - Conditional scenarios ("What if..." questions)

                    **Requirements:**
                    - All answers must be factually accurate based on the provided document
                    - Use clear, accessible language appropriate for the document type
                    - Include specific details like timeframes, amounts, percentages, or criteria when mentioned
                    - Ensure consistency and avoid contradictory information in answers
                    - Focus on the most important and commonly asked aspects of the document content provided

                    ${chunkNumber ? `Note: This is chunk ${chunkNumber} of a larger document. Focus on the content in this specific section.` : ''}

                    Now analyze the provided document content and generate 3-5 query-answer examples following the above guidelines.`,
                },
                {
                    role: "user",
                    content: content,
                },
            ],
            max_tokens: 1500,
        });

        return response.choices[0].message.content ?? "";
    }

    async getFewShotExamples(documentName: string): Promise<string | null> {
        return await this.getFewShotExamplesFromDB(documentName);
    }

    /**
     * Retrieves few-shot examples from the database based on the given document name.
     * @example
     * getFewShotExamplesFromDB('sample_document')
     * Returns 'Example text' if found, otherwise null.
     * @param {string} documentName - The name of the document for which to fetch few-shot examples.
     * @returns {Promise<string | null>} The few-shot examples associated with the document or null if not found.
     */
    private async getFewShotExamplesFromDB(documentName: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('few_shot_examples')
                .select('few_shot_examples')
                .eq('document_name', documentName)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }

            return data?.few_shot_examples || null;
        } catch (error) {
            console.error('Error fetching few-shot examples from database:', error);
            return null;
        }
    }

    /**
     * Stores few-shot examples related to a document in the database.
     * @example
     * storeFewShotExamplesInDB('doc1', 'example1, example2')
     * // No return value, but logs "Few-shot examples stored in database for document: doc1" if successful
     * @param {string} documentName - The name of the document to associate with the few-shot examples.
     * @param {string} fewShotExamples - The few-shot examples to be stored in the database.
     * @returns {Promise<void>} Resolves to void when the operation is complete. Throws an error if the operation fails.
     */
    private async storeFewShotExamplesInDB(documentName: string, fewShotExamples: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('few_shot_examples')
                .insert({
                    document_name: documentName,
                    few_shot_examples: fewShotExamples
                });

            if (error) throw error;

            console.log(`Few-shot examples stored in database for document: ${documentName}`);
        } catch (error) {
            console.error('Error storing few-shot examples in database:', error);
            throw error;
        }
    }

    /**
     * Retrieves and processes documents from the database, grouping them by document name and counting the chunks.
     * @example
     * getProcessedDocuments()
     * Returns an array of objects with properties: name, created_at, and chunk_count.
     * @returns {Promise<any[]>} A promise that resolves to an array of processed document objects each containing name, created_at, and chunk_count.
     */
    async getProcessedDocuments(): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('document_name, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Group by document_name and count chunks
            const documentsMap = new Map();
            
            data?.forEach(doc => {
                if (!documentsMap.has(doc.document_name)) {
                    documentsMap.set(doc.document_name, {
                        name: doc.document_name,
                        created_at: doc.created_at,
                        chunk_count: 0
                    });
                }
                documentsMap.get(doc.document_name).chunk_count++;
            });

            return Array.from(documentsMap.values());
        } catch (error) {
            console.error('Error fetching processed documents:', error);
            throw error;
        }
    }

    /**
     * Deletes a document and its related few-shot examples from the database.
     * @example
     * deleteDocument("exampleDocument")
     * // Returns: { deletedChunks: 5, deletedExamples: true }
     * @param {string} documentName - The name of the document to delete.
     * @returns {Promise<{ deletedChunks: number; deletedExamples: boolean }>} An object containing the number of deleted chunks and a boolean indicating whether few-shot examples were successfully deleted.
     */
    async deleteDocument(documentName: string): Promise<{ deletedChunks: number; deletedExamples: boolean }> {
        try {
            // Delete document chunks
            const { count: deletedChunks, error: chunksError } = await supabase
                .from('documents')
                .delete({ count: 'exact' })
                .eq('document_name', documentName);

            if (chunksError) throw chunksError;

            // Delete few-shot examples
            const { error: examplesError } = await supabase
                .from('few_shot_examples')
                .delete()
                .eq('document_name', documentName);

            const deletedExamples = !examplesError;

            return {
                deletedChunks: deletedChunks || 0,
                deletedExamples
            };
        } catch (error) {
            console.error('Error deleting document:', error);
            throw error;
        }
    }
}
