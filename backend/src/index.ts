import { getPdfContent } from "./file";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { hfClient, getEmbeddingPipeline, supabase } from "./config";
import dotenv from 'dotenv';
dotenv.config();

const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 12000,
    chunkOverlap: 1500,
});

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Rough token estimation (1 token ≈ 4 characters for English text)
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

// Split text into chunks that fit within token limits
function splitTextForTokenLimit(text: string, maxTokens: number): string[] {
    const maxChars = maxTokens * 4; // Conservative estimate
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += maxChars) {
        chunks.push(text.slice(i, i + maxChars));
    }

    return chunks;
}

// Check if few-shot examples already exist for the document
async function getFewShotExamplesFromDB(documentName: string): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('few_shot_examples')
            .select('few_shot_examples')
            .eq('document_name', documentName)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found
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

// Store few-shot examples in the database
async function storeFewShotExamplesInDB(documentName: string, fewShotExamples: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('few_shot_examples')
            .insert({
                document_name: documentName,
                few_shot_examples: fewShotExamples
            });

        if (error) {
            throw error;
        }

        console.log(`Few-shot examples stored in database for document: ${documentName}`);
    } catch (error) {
        console.error('Error storing few-shot examples in database:', error);
    }
}

async function createFewShotExamples(pdfContent: string, documentName: string): Promise<string> {
    // First, check if few-shot examples already exist in the database
    console.log(`Checking for existing few-shot examples for document: ${documentName}`);
    const existingExamples = await getFewShotExamplesFromDB(documentName);

    if (existingExamples) {
        console.log(`Found existing few-shot examples for ${documentName}. Using cached version.`);
        return existingExamples;
    }

    console.log(`No existing few-shot examples found. Generating new ones for ${documentName}...`);

    // GPT-4o-mini has a context window of 128k tokens, but we'll be conservative
    // Leave room for system prompt and response (estimate ~2000 tokens for system + response)
    const maxInputTokens = 40000; // More conservative limit per request
    const estimatedTokens = estimateTokens(pdfContent);

    console.log(`Estimated tokens: ${estimatedTokens}`);

    let fewShotExamples: string;

    if (estimatedTokens <= maxInputTokens) {
        // Single request if within limits
        fewShotExamples = await processSingleChunkForExamples(pdfContent);
    } else {
        // Split into multiple chunks
        const chunks = splitTextForTokenLimit(pdfContent, maxInputTokens);
        console.log(`Splitting document into ${chunks.length} chunks for few-shot example generation...`);

        const allExamples: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
            console.log(`Processing chunk ${i + 1}/${chunks.length} for few-shot examples...`);

            try {
                const examples = await processSingleChunkForExamples(chunks[i], i + 1);
                allExamples.push(examples);

                // Add delay between requests to respect rate limits
                if (i < chunks.length - 1) {
                    console.log('Waiting 5 seconds before next chunk...');
                    await delay(5000);
                }

            } catch (error: any) {
                if (error.code === 'rate_limit_exceeded') {
                    console.log(`Rate limit hit on chunk ${i + 1}. Waiting 60 seconds...`);
                    await delay(60000);
                    i--; // Retry the same chunk
                } else {
                    console.error(`Error processing chunk ${i + 1}:`, error);
                }
            }
        }

        // Combine all examples
        fewShotExamples = allExamples.join('\n\n');
    }

    // Store the generated examples in the database
    await storeFewShotExamplesInDB(documentName, fewShotExamples);

    return fewShotExamples;
}

// New optimized function that processes whole document unless it exceeds 128k tokens
async function createFewShotExamplesOptimized(pdfContent: string, documentName: string): Promise<string> {
    // First, check if few-shot examples already exist in the database
    console.log(`Checking for existing few-shot examples for document: ${documentName}`);
    const existingExamples = await getFewShotExamplesFromDB(documentName);

    if (existingExamples) {
        console.log(`Found existing few-shot examples for ${documentName}. Using cached version.`);
        return existingExamples;
    }

    console.log(`No existing few-shot examples found. Generating new ones for ${documentName}...`);

    // gpt-oss-120b has a context window of 128k tokens
    // Leave room for system prompt and response (estimate ~3000 tokens for system + response)
    const maxInputTokens = 125000; // Use most of the 128k context window
    const estimatedTokens = estimateTokens(pdfContent);

    console.log(`Estimated tokens: ${estimatedTokens}`);

    let fewShotExamples: string;

    if (estimatedTokens <= maxInputTokens) {
        // Process whole document in single request
        console.log('Processing entire document in single request...');
        fewShotExamples = await processSingleChunkForExamplesOptimized(pdfContent);
    } else {
        // Only chunk if document exceeds 128k token limit
        console.log(`Document exceeds ${maxInputTokens} tokens. Splitting into chunks...`);
        const chunks = splitTextForTokenLimit(pdfContent, maxInputTokens);
        console.log(`Splitting document into ${chunks.length} chunks for few-shot example generation...`);

        const allExamples: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
            console.log(`Processing chunk ${i + 1}/${chunks.length} for few-shot examples...`);

            try {
                const examples = await processSingleChunkForExamplesOptimized(chunks[i], i + 1);
                allExamples.push(examples);

                // Small delay between chunks to be respectful
                if (i < chunks.length - 1) {
                    console.log('Waiting 2 seconds before next chunk...');
                    await delay(2000);
                }

            } catch (error: any) {
                console.error(`Error processing chunk ${i + 1}:`, error);
                // Continue with other chunks even if one fails
            }
        }

        // Combine all examples
        fewShotExamples = allExamples.join('\n\n');
    }

    // Store the generated examples in the database
    await storeFewShotExamplesInDB(documentName, fewShotExamples);

    return fewShotExamples;
}

async function processSingleChunkForExamples(content: string, chunkNumber?: number): Promise<string> {
    const chunkInfo = chunkNumber ? ` (Chunk ${chunkNumber})` : '';

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
        max_tokens: 100000,
    });

    return response.choices[0].message.content ?? "";
}

async function storeEmbeddedChunksAll(pdfPath: string = 'bajaj-2.pdf'): Promise<any[]> {
    const pdfContent = await getPdfContent(pdfPath);

    if (pdfContent) {
        const chunks = await textSplitter.splitText(pdfContent);
        console.log(`Processing all ${chunks.length} chunks in parallel...`);

        try {
            const embeddedChunks = await Promise.all(
                chunks.map(async (chunk, index) => {
                    console.log(`Processing chunk ${index + 1}/${chunks.length}...`);
                    const embeddingModel = await getEmbeddingPipeline();
                    const output = await embeddingModel(chunk, { pooling: 'mean', normalize: true });
                    const embedding = Array.from(output.data);

                    await supabase.from('documents').insert({
                        content: chunk,
                        embedding: embedding,
                        document_name: pdfPath,
                        chunk_index: index,
                        created_at: new Date().toISOString()
                    });

                    return {
                        chunk: chunk,
                        embedding: embedding,
                        document_name: pdfPath,
                        chunk_index: index
                    };
                })
            );

            console.log(`Successfully processed and stored ${embeddedChunks.length} chunks`);
            return embeddedChunks;
        } catch (error) {
            console.error('Error processing chunks:', error);
            throw error;
        }
    } else {
        console.log("No content extracted from the PDF.");
        return [];
    }
}

async function storeEmbeddedChunksBatched(): Promise<any[]> {
    const pdfPath = 'bajaj-2.pdf';
    const pdfContent = await getPdfContent(pdfPath);

    if (pdfContent) {
        const chunks = await textSplitter.splitText(pdfContent);
        const embeddedChunks: any[] = [];
        const batchSize = 2; // Reduced batch size to be more conservative
        const delayBetweenBatches = 8000; // Increased delay to 8 seconds

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

                        await supabase.from('documents').insert({
                            content: chunk,
                            embedding: embedding
                        });

                        return {
                            chunk: chunk,
                            embedding: embedding,
                        };
                    })
                );

                embeddedChunks.push(...batchResults);

                // Delay between batches
                if (i + batchSize < chunks.length) {
                    console.log(`Waiting ${delayBetweenBatches / 1000} seconds before next batch...`);
                    await delay(delayBetweenBatches);
                }

            } catch (error: any) {
                if (error.code === 'rate_limit_exceeded') {
                    console.log('Rate limit hit. Waiting 60 seconds...');
                    await delay(60000);
                    i -= batchSize; // Retry the same batch
                } else {
                    console.error('Error processing batch:', error);
                }
            }
        }

        return embeddedChunks;
    } else {
        console.log("No content extracted from the PDF.");
        return [];
    }
}

async function queryEmbeddedChunks(query: string, fewShotExamples: string): Promise<string> {
    const embeddingModel = await getEmbeddingPipeline();
    const output = await embeddingModel(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data);

    const { data } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.20,
        match_count: 10
    });

    const queryResponse = await hfClient.chatCompletion({
        model: "openai/gpt-oss-120b",
        messages: [
            {
                role: "system",
                content: `You are a helpful assistant that answers questions based on the provided context. Do not make up information and always try to stick to the context as much as possible.
                Here are few-shot examples of how to answer questions:

                ${fewShotExamples}
                `,
            },
            {
                role: "user",
                content: `Answer the question based on the following context:\n${JSON.stringify(data)}\n\nQuestion: ${query}`
            }
        ],
        max_tokens: 100000,
    });

    return queryResponse.choices[0].message.content ?? "";
}

async function storeEmbeddedChunks() {
    // Use the parallel version for faster processing without rate limits
    const embeddedChunks = await storeEmbeddedChunksAll();
    console.log("Stored Embedded Chunks:", embeddedChunks.length);
}

// Alternative function to use batched processing if needed
async function storeEmbeddedChunksSlow() {
    const embeddedChunks = await storeEmbeddedChunksBatched();
    console.log("Stored Embedded Chunks (Batched):", embeddedChunks.length);
}

async function fetchQueryResults() {
    const pdfPath = 'bajaj-2.pdf';
    const documentName = pdfPath; // Use filename as document identifier
    const pdfContent = await getPdfContent(pdfPath);

    console.log("Getting few-shot examples...");
    const fewShotExamples = await createFewShotExamples(pdfContent, documentName);
    console.log("Few-shot examples ready!");

    const query = "What are the three mandatory Base Covers that every policyholder must avail in the policy?";
    const result = await queryEmbeddedChunks(query, fewShotExamples);
    console.log("Query Results:\n", result);
}

fetchQueryResults();

// Helper function to process a single chunk for few-shot examples (optimized version)
async function processSingleChunkForExamplesOptimized(chunk: string, chunkNumber?: number): Promise<string> {
    const chunkPrefix = chunkNumber ? ` (Chunk ${chunkNumber})` : '';

    const prompt = `You are an expert assistant. Based on the following document content${chunkPrefix}, create 3-5 high-quality question-answer pairs that demonstrate the types of questions users might ask about this content and how to answer them comprehensively.

Each question should be realistic and relevant to the document content. Each answer should be detailed, accurate, and cite specific information from the document.

Format as:
Q: [Question]
A: [Detailed Answer]

Document Content:
${chunk}

Generate the question-answer pairs:`;

    const response = await hfClient.chatCompletion({
        model: "openai/gpt-oss-120b",
        messages: [
            {
                role: "system",
                content: "You are an expert document analyzer. Generate high-quality question-answer pairs based on the document content provided."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        max_tokens: 1000,
    });

    return response.choices[0].message.content ?? "";
}

export { createFewShotExamples, createFewShotExamplesOptimized, storeEmbeddedChunksAll };