import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getPdfContent } from './file';
import { DocumentService } from './services/documentService';
import { QueryService } from './services/queryService';
import { EmbeddingService } from './services/embeddingService';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'));
        }
    },
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Services
const documentService = new DocumentService();
const queryService = new QueryService();
const embeddingService = new EmbeddingService();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Upload and process PDF endpoint
app.post('/api/documents/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const filePath = req.file.path;
        const fileName = req.file.originalname;
        
        console.log(`Processing uploaded file: ${fileName}`);
        
        // Extract PDF content
        const pdfContent = await getPdfContent(filePath);
        if (!pdfContent) {
            return res.status(400).json({ error: 'Failed to extract content from PDF' });
        }

        // Process document and store embeddings
        const result = await documentService.processDocument(pdfContent, fileName, filePath);
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        
        res.json({
            message: 'Document processed successfully',
            documentName: fileName,
            chunksProcessed: result.chunksProcessed,
            fewShotExamplesGenerated: result.fewShotExamplesGenerated
        });
        
    } catch (error: any) {
        console.error('Error processing document:', error);
        
        // Clean up file if it exists
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            error: 'Failed to process document',
            details: error.message 
        });
    }
});

// Process existing PDF endpoint
app.post('/api/documents/process', async (req, res) => {
    try {
        const { fileName } = req.body;
        
        if (!fileName) {
            return res.status(400).json({ error: 'fileName is required' });
        }

        const filePath = path.join(__dirname, '..', fileName);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        console.log(`Processing existing file: ${fileName}`);
        
        // Extract PDF content
        const pdfContent = await getPdfContent(filePath);
        if (!pdfContent) {
            return res.status(400).json({ error: 'Failed to extract content from PDF' });
        }

        // Process document and store embeddings
        const result = await documentService.processDocument(pdfContent, fileName, filePath);
        
        res.json({
            message: 'Document processed successfully',
            documentName: fileName,
            chunksProcessed: result.chunksProcessed,
            fewShotExamplesGenerated: result.fewShotExamplesGenerated
        });
        
    } catch (error: any) {
        console.error('Error processing document:', error);
        res.status(500).json({ 
            error: 'Failed to process document',
            details: error.message 
        });
    }
});

// Query documents endpoint
app.post('/api/query', async (req, res) => {
    try {
        const { query, documentName } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log(`Processing query: ${query}`);
        
        const result = await queryService.queryDocuments(query, documentName);
        
        res.json({
            query: query,
            answer: result.answer,
            sources: result.sources,
            confidence: result.confidence
        });
        
    } catch (error: any) {
        console.error('Error processing query:', error);
        res.status(500).json({ 
            error: 'Failed to process query',
            details: error.message 
        });
    }
});

// Get few-shot examples endpoint
app.get('/api/documents/:documentName/examples', async (req, res) => {
    try {
        const { documentName } = req.params;
        
        const examples = await documentService.getFewShotExamples(documentName);
        
        if (!examples) {
            return res.status(404).json({ error: 'Few-shot examples not found for this document' });
        }
        
        res.json({
            documentName: documentName,
            fewShotExamples: examples
        });
        
    } catch (error: any) {
        console.error('Error fetching few-shot examples:', error);
        res.status(500).json({ 
            error: 'Failed to fetch few-shot examples',
            details: error.message 
        });
    }
});

// List processed documents endpoint
app.get('/api/documents', async (req, res) => {
    try {
        const documents = await documentService.getProcessedDocuments();
        
        res.json({
            documents: documents,
            total: documents.length
        });
        
    } catch (error: any) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ 
            error: 'Failed to fetch documents',
            details: error.message 
        });
    }
});

// Get embedding statistics endpoint
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await embeddingService.getEmbeddingStats();
        
        res.json({
            stats: stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            error: 'Failed to fetch statistics',
            details: error.message 
        });
    }
});

// Search similar chunks endpoint
app.post('/api/search', async (req, res) => {
    try {
        const { query, documentName, limit = 5 } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const results = await queryService.searchSimilarChunks(query, documentName, limit);
        
        res.json({
            query: query,
            results: results,
            total: results.length
        });
        
    } catch (error: any) {
        console.error('Error searching chunks:', error);
        res.status(500).json({ 
            error: 'Failed to search chunks',
            details: error.message 
        });
    }
});

// Delete document and its data endpoint
app.delete('/api/documents/:documentName', async (req, res) => {
    try {
        const { documentName } = req.params;
        
        const result = await documentService.deleteDocument(documentName);
        
        res.json({
            message: 'Document deleted successfully',
            documentName: documentName,
            deletedChunks: result.deletedChunks,
            deletedExamples: result.deletedExamples
        });
        
    } catch (error: any) {
        console.error('Error deleting document:', error);
        res.status(500).json({ 
            error: 'Failed to delete document',
            details: error.message 
        });
    }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
        }
    }
    
    res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 API Documentation available at http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
