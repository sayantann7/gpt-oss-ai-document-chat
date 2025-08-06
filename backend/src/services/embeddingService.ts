import { getEmbeddingPipeline, supabase } from '../config';

export interface EmbeddingStats {
    totalDocuments: number;
    totalChunks: number;
    averageChunkSize: number;
    documentsWithExamples: number;
}

export class EmbeddingService {
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async createEmbedding(text: string): Promise<number[]> {
        try {
            // Use local embedding model instead of OpenAI
            const embeddingModel = await getEmbeddingPipeline();
            const output = await embeddingModel(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        } catch (error) {
            console.error('Error creating embedding:', error);
            throw error;
        }
    }

    async batchCreateEmbeddings(texts: string[], batchSize: number = 2, delayMs: number = 8000): Promise<number[][]> {
        const embeddings: number[][] = [];
        
        console.log(`Creating embeddings for ${texts.length} texts in batches of ${batchSize}...`);

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}...`);

            try {
                const batchEmbeddings = await Promise.all(
                    batch.map(async (text) => {
                        return await this.createEmbedding(text);
                    })
                );

                embeddings.push(...batchEmbeddings);

                // Delay between batches
                if (i + batchSize < texts.length) {
                    console.log(`Waiting ${delayMs / 1000} seconds before next batch...`);
                    await this.delay(delayMs);
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

        return embeddings;
    }

    async getEmbeddingStats(): Promise<EmbeddingStats> {
        try {
            // Get total chunks count
            const { count: totalChunks, error: chunksError } = await supabase
                .from('documents')
                .select('*', { count: 'exact', head: true });

            if (chunksError) throw chunksError;

            // Get unique documents count
            const { data: allDocs, error: docsError } = await supabase
                .from('documents')
                .select('document_name');

            if (docsError) throw docsError;

            const uniqueDocs = allDocs ? [...new Set(allDocs.map(doc => doc.document_name))] : [];

            // Get average chunk size
            const { data: chunkSizes, error: sizesError } = await supabase
                .from('documents')
                .select('content');

            if (sizesError) throw sizesError;

            const averageChunkSize = chunkSizes && chunkSizes.length > 0
                ? chunkSizes.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunkSizes.length
                : 0;

            // Get documents with few-shot examples
            const { count: documentsWithExamples, error: examplesError } = await supabase
                .from('few_shot_examples')
                .select('*', { count: 'exact', head: true });

            if (examplesError) throw examplesError;

            return {
                totalDocuments: uniqueDocs.length,
                totalChunks: totalChunks || 0,
                averageChunkSize: Math.round(averageChunkSize),
                documentsWithExamples: documentsWithExamples || 0
            };
        } catch (error) {
            console.error('Error getting embedding stats:', error);
            throw error;
        }
    }

    async searchSimilarEmbeddings(queryEmbedding: number[], threshold: number = 0.5, limit: number = 10): Promise<any[]> {
        try {
            const { data, error } = await supabase.rpc('match_documents', {
                query_embedding: queryEmbedding,
                match_threshold: threshold,
                match_count: limit
            });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error searching similar embeddings:', error);
            throw error;
        }
    }

    async updateEmbedding(id: string, newContent: string): Promise<void> {
        try {
            // Create new embedding
            const embedding = await this.createEmbedding(newContent);

            // Update in database
            const { error } = await supabase
                .from('documents')
                .update({
                    content: newContent,
                    embedding: embedding,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            console.log(`Updated embedding for document ID: ${id}`);
        } catch (error) {
            console.error('Error updating embedding:', error);
            throw error;
        }
    }

    async deleteEmbedding(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', id);

            if (error) throw error;
            console.log(`Deleted embedding for document ID: ${id}`);
        } catch (error) {
            console.error('Error deleting embedding:', error);
            throw error;
        }
    }

    async reindexDocument(documentName: string, newContent: string): Promise<number> {
        try {
            console.log(`Reindexing document: ${documentName}`);

            // Delete existing chunks
            const { error: deleteError } = await supabase
                .from('documents')
                .delete()
                .eq('document_name', documentName);

            if (deleteError) throw deleteError;

            // Create new chunks and embeddings
            // This would typically use the DocumentService, but for simplicity:
            const chunks = this.splitIntoChunks(newContent);
            const embeddings = await this.batchCreateEmbeddings(chunks);

            // Store new chunks with embeddings
            const insertData = chunks.map((chunk, index) => ({
                content: chunk,
                embedding: embeddings[index],
                document_name: documentName,
                chunk_index: index,
                created_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
                .from('documents')
                .insert(insertData);

            if (insertError) throw insertError;

            console.log(`Reindexed ${chunks.length} chunks for document: ${documentName}`);
            return chunks.length;
        } catch (error) {
            console.error('Error reindexing document:', error);
            throw error;
        }
    }

    private splitIntoChunks(text: string, chunkSize: number = 12000, overlap: number = 1500): string[] {
        const chunks: string[] = [];
        const step = chunkSize - overlap;

        for (let i = 0; i < text.length; i += step) {
            const end = Math.min(i + chunkSize, text.length);
            chunks.push(text.slice(i, end));
            
            if (end >= text.length) break;
        }

        return chunks;
    }
}
