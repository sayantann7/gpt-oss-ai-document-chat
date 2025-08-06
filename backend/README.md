# Bajaj Hackathon - Document Processing API

A production-ready Express.js backend for intelligent document processing, featuring PDF content extraction, vector embeddings, and AI-powered query responses.

## ✨ Features

- 📄 **PDF Processing**: Upload and extract content from PDF documents
- 🔍 **Vector Search**: Generate embeddings for semantic document search
- 🤖 **AI Querying**: RAG (Retrieval Augmented Generation) with OpenAI GPT-4o-mini
- 📚 **Few-shot Learning**: Automatically generate training examples from documents
- 🗄️ **Database Integration**: Persistent storage with Supabase
- ⚡ **Rate Limiting**: Built-in OpenAI API rate limiting and retry logic
- 🛡️ **Error Handling**: Comprehensive error handling and validation
- 📊 **Analytics**: Document and embedding statistics
- 🚀 **Production Ready**: Proper middleware, logging, and security

## 🏗️ Architecture

```
├── src/
│   ├── server.ts           # Express server and API routes
│   ├── config.ts           # OpenAI and Supabase configuration
│   ├── file.ts            # PDF content extraction utilities
│   ├── index.ts           # Original CLI implementation
│   └── services/
│       ├── documentService.ts   # Document processing logic
│       ├── queryService.ts      # Query and search functionality
│       └── embeddingService.ts  # Embedding management
├── examples.js            # API usage examples
├── start.sh              # Production startup script
└── API_DOCUMENTATION.md  # Detailed API documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- OpenAI API key
- Supabase account and project

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd bajaj-hackathon
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Create Supabase tables:**
Execute the SQL commands in `API_DOCUMENTATION.md` in your Supabase dashboard.

4. **Start the server:**
```bash
npm run server
# or use the startup script
./start.sh
```

The server will start on `http://localhost:3000` (or your configured PORT).

## 📡 API Endpoints

### Core Endpoints

- `GET /health` - Health check
- `POST /api/documents/upload` - Upload PDF file
- `POST /api/documents/process` - Process existing PDF
- `POST /api/query` - Query documents with AI
- `GET /api/documents` - List processed documents
- `GET /api/stats` - Get system statistics

### Advanced Endpoints

- `POST /api/search` - Semantic search in documents
- `GET /api/documents/:name/examples` - Get few-shot examples
- `DELETE /api/documents/:name` - Delete document and data

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_API_KEY` | Supabase API key | ✅ |
| `PORT` | Server port | ❌ (default: 3000) |
| `NODE_ENV` | Environment mode | ❌ (default: development) |

### Rate Limiting

The system includes intelligent rate limiting:
- **Embeddings**: 2 requests per batch, 8-second delays
- **Chat Completions**: 5-second delays between requests
- **Automatic Retry**: Exponential backoff for rate limit errors

## 📊 Usage Examples

### 1. Process a Document

```javascript
const response = await fetch('/api/documents/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: 'document.pdf' })
});
```

### 2. Query Documents

```javascript
const response = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        query: "What are the eligibility criteria?",
        documentName: "document.pdf"
    })
});
```

### 3. Upload New Document

```javascript
const formData = new FormData();
formData.append('pdf', fileInput.files[0]);

const response = await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData
});
```

See `examples.js` for complete working examples.

## 🏭 Production Deployment

### Using PM2

```bash
npm install -g pm2
npm run build
pm2 start dist/server.js --name "bajaj-api"
pm2 startup
pm2 save
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Use a reverse proxy (nginx)
3. Enable HTTPS
4. Set up monitoring and logging
5. Configure firewall rules

## 🧪 Testing

Run the built-in test:

```bash
npm run build
node dist/test.js
```

Test individual API endpoints:

```bash
node examples.js
```

## 📈 Performance

- **Concurrent Processing**: Batched embedding generation
- **Smart Caching**: Few-shot examples cached in database
- **Vector Search**: Optimized similarity search with pgvector
- **Memory Management**: Chunked processing for large documents

## 🛠️ Development

### Scripts

- `npm run build` - Build TypeScript
- `npm run server` - Start production server
- `npm run watch` - Development with auto-reload
- `npm run dev` - Run original CLI version

### Database Schema

The system uses two main tables:

1. **documents**: Stores text chunks with vector embeddings
2. **few_shot_examples**: Stores AI-generated training examples

Both tables are automatically managed by the service layer.

## 🔒 Security

- Input validation on all endpoints
- File type and size restrictions
- SQL injection prevention with Supabase
- Rate limiting for API abuse prevention
- Environment variable protection

## 📋 Error Handling

The API provides comprehensive error responses:

```json
{
  "error": "Description of error",
  "details": "Detailed error information",
  "timestamp": "2025-01-31T..."
}
```

Common error scenarios:
- Invalid file uploads
- Rate limit exceeded
- Database connection issues
- Missing environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

- Check `API_DOCUMENTATION.md` for detailed API specs
- Run `examples.js` for usage examples
- Review error logs for troubleshooting
- Ensure environment variables are properly configured

---

Built with ❤️ for the Bajaj Hackathon
