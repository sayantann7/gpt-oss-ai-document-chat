# 🤖 AI Document Chat

An intelligent document processing and chat system that allows users to upload PDF documents and interact with them using natural language queries. Built with Next.js frontend and Express.js backend, powered by OpenAI GPT-OSS and Supabase vector database.

![AI Document Chat](https://img.shields.io/badge/AI-Document%20Chat-blue?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.4.5-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-green?style=flat-square&logo=openai)

## ✨ Features

### 🎯 Core Functionality
- **📄 PDF Document Upload**: Upload and process PDF documents with intelligent text extraction
- **🧠 AI-Powered Chat**: Query documents using natural language with GPT-OSS
- **🔍 Vector Search**: Semantic search using document embeddings for accurate context retrieval
- **⚡ Real-time Responses**: Live typing effect for AI responses with smooth UX
- **📊 Document Management**: View, manage, and delete processed documents

### 🎨 User Experience
- **🌙 Dark Theme**: Modern dark UI with high contrast for better readability
- **🎭 Custom Typography**: Nexa Heavy and Nexa Light fonts for premium look
- **📱 Responsive Design**: Optimized for desktop and mobile devices
- **⏳ Loading States**: Smooth loading animations and progress indicators
- **🎪 Interactive Elements**: Hover effects and smooth transitions

### 🔧 Technical Features
- **🚀 Production Ready**: Comprehensive error handling and validation
- **📈 Rate Limiting**: Built-in OpenAI API rate limiting with retry logic
- **🗄️ Vector Database**: Persistent storage with Supabase and pgvector
- **🛡️ Type Safety**: Full TypeScript implementation
- **⚡ Performance**: Optimized chunking and batch processing

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Next.js       │────▶│   Express.js    │────▶│   Supabase      │
│   Frontend      │     │   Backend       │     │   Database      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   React UI      │     │   OpenAI API    │     │   Vector Store  │
│   Components    │     │   Integration   │     │   (pgvector)    │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **OpenAI API Key**
- **Supabase Account** and project
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/sayantann7/gpt-oss-ai-document-chat.git
cd gpt-oss-ai-document-chat
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure your environment variables
nano .env
```

**Environment Variables (.env):**
```env
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_API_KEY=your_supabase_anon_key
PORT=3000
NODE_ENV=development
```

**Setup Supabase Database:**

Execute these SQL commands in your Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  document_name TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create few_shot_examples table
CREATE TABLE few_shot_examples (
  id SERIAL PRIMARY KEY,
  document_name TEXT NOT NULL,
  example_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_documents_name ON documents(document_name);
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_examples_name ON few_shot_examples(document_name);
```

**Start Backend:**
```bash
npm run build
npm run server
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Configure frontend environment
nano .env.local
```

**Frontend Environment (.env.local):**
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

**Start Frontend:**
```bash
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 📖 Usage Guide

### 1. Upload Documents

1. Navigate to the upload section
2. Select a PDF file (max 10MB)
3. Click "Upload PDF" to process the document
4. Wait for the processing to complete

### 2. Process Existing Documents

1. Use the "Process Existing Documents" section
2. Enter the filename of a PDF in the uploads folder
3. Click "Process" to extract content and generate embeddings

### 3. Query Documents

1. Select a processed document from the dropdown
2. Enter your question in natural language
3. Click "Ask Question" to get AI-powered responses
4. Watch the response type out in real-time

### 4. Manage Documents

- View all processed documents in the sidebar
- See document statistics (total documents, embeddings)
- Delete documents and their associated data

## 🛠️ Development

### Project Structure

```
gpt-oss-ai-document-chat/
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── server.ts          # Main server file
│   │   ├── config.ts          # Configuration
│   │   ├── file.ts           # PDF processing utilities
│   │   └── services/
│   │       ├── documentService.ts
│   │       ├── queryService.ts
│   │       └── embeddingService.ts
│   ├── uploads/               # PDF file storage
│   └── package.json
│
├── frontend/                  # Next.js React application
│   ├── app/
│   │   ├── page.tsx          # Main application page
│   │   ├── layout.tsx        # Root layout
│   │   ├── globals.css       # Global styles
│   │   └── advanced/
│   │       └── page.tsx      # Advanced features page
│   ├── lib/
│   │   └── api.ts           # API client and types
│   ├── public/              # Static assets
│   └── package.json
│
└── README.md                 # This file
```

### Development Scripts

**Backend:**
```bash
npm run build      # Build TypeScript
npm run server     # Start production server
npm run dev        # Development with auto-rebuild
npm run watch      # Watch mode for development
```

**Frontend:**
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/documents` | List all documents |
| `POST` | `/api/documents/upload` | Upload new PDF |
| `POST` | `/api/documents/process` | Process existing PDF |
| `POST` | `/api/query` | Query documents |
| `POST` | `/api/search` | Semantic search |
| `GET` | `/api/stats` | System statistics |
| `DELETE` | `/api/documents/:name` | Delete document |

## 🔧 Configuration

### Frontend Configuration

**Tailwind CSS**: Custom dark theme with Nexa fonts
**TypeScript**: Strict type checking enabled
**API Client**: Centralized error handling and request management

### Backend Configuration

**Rate Limiting**: 
- Embeddings: 2 requests per batch, 8-second delays
- Chat completions: 5-second delays
- Automatic retry with exponential backoff

**File Processing**:
- Maximum file size: 10MB
- Supported formats: PDF
- Text chunking: 1000 characters with 200 character overlap

**Vector Search**:
- Embedding model: text-embedding-ada-002
- Similarity threshold: Configurable
- Batch processing for better performance

## 🚀 Deployment

### Production Environment Variables

```env
# Backend (.env)
OPENAI_API_KEY=your_production_openai_key
SUPABASE_URL=your_production_supabase_url
SUPABASE_API_KEY=your_production_supabase_key
PORT=3000
NODE_ENV=production

# Frontend (.env.local)
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com
```

### Deployment Options

#### Option 1: Vercel (Frontend) + Railway (Backend)

**Frontend (Vercel):**
```bash
npm run build
# Deploy to Vercel
```

**Backend (Railway):**
```bash
# Create railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run server",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

#### Option 2: Docker Deployment

**Dockerfile (Backend):**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "server"]
```

**Dockerfile (Frontend):**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

#### Option 3: PM2 (VPS/Server)

```bash
# Install PM2 globally
npm install -g pm2

# Start backend
cd backend
npm run build
pm2 start dist/server.js --name "ai-chat-backend"

# Start frontend
cd ../frontend
npm run build
pm2 start npm --name "ai-chat-frontend" -- start

# Save PM2 configuration
pm2 startup
pm2 save
```

## 🧪 Testing

### Manual Testing

```bash
# Test backend health
curl http://localhost:3000/health

# Test document upload
curl -X POST -F "pdf=@test.pdf" http://localhost:3000/api/documents/upload

# Test query
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"What is this document about?","documentName":"test.pdf"}' \
  http://localhost:3000/api/query
```

### Automated Testing

```bash
cd backend
node examples.js  # Run example API calls
```

## 🛡️ Security

- **Input Validation**: All endpoints validate input data
- **File Type Restrictions**: Only PDF files allowed
- **Size Limits**: Maximum 10MB file uploads
- **Rate Limiting**: Prevents API abuse
- **Environment Variables**: Sensitive data stored securely
- **CORS Configuration**: Proper cross-origin setup

## 📊 Performance

- **Vector Search**: Optimized with pgvector indexes
- **Chunking Strategy**: Balanced for context and performance
- **API Rate Limiting**: Prevents OpenAI quota exhaustion
- **Batch Processing**: Efficient embedding generation
- **Memory Management**: Proper cleanup and garbage collection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Maintain consistent code formatting
- Add proper error handling
- Update documentation for new features
- Test thoroughly before submitting

## 🐛 Troubleshooting

### Common Issues

**1. "Cannot read properties of undefined (reading 'isTTY')"**
- Remove `dotenv` import from frontend code
- Use environment variables properly in Next.js

**2. OpenAI Rate Limit Errors**
- Check your API quota
- Reduce batch sizes in embedding service
- Increase delay between requests

**3. Supabase Connection Issues**
- Verify your Supabase URL and API key
- Check if pgvector extension is enabled
- Ensure tables are created properly

**4. PDF Processing Failures**
- Check file size (max 10MB)
- Ensure PDF is not password protected
- Verify file is not corrupted

### Debugging Tips

```bash
# Check backend logs
npm run server

# Check frontend build
npm run build

# Test API endpoints
curl -v http://localhost:3000/health

# Check environment variables
echo $OPENAI_API_KEY
echo $SUPABASE_URL
```

## 📋 Roadmap

- [ ] **Multi-language Support**: Process documents in different languages
- [ ] **Advanced File Types**: Support for DOCX, TXT, and other formats
- [ ] **User Authentication**: User accounts and document privacy
- [ ] **Real-time Collaboration**: Multiple users querying same documents
- [ ] **Advanced Analytics**: Usage statistics and insights
- [ ] **Mobile App**: React Native companion app
- [ ] **API Rate Monitoring**: Real-time API usage dashboard
- [ ] **Custom Model Support**: Integration with other LLM providers

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for providing the GPT-OSS API
- **Supabase** for the excellent database and vector storage
- **Next.js** team for the amazing React framework
- **Vercel** for the deployment platform
- **The open-source community** for the incredible tools and libraries

## 📞 Support

- **GitHub Issues**: [Create an issue](https://github.com/sayantann7/gpt-oss-ai-document-chat/issues)
- **Documentation**: Check the `API_DOCUMENTATION.md` in the backend folder
- **Examples**: Run `examples.js` for API usage examples

---

**Built with ❤️ by [Sayantan](https://github.com/sayantann7)**

⭐ **If you found this project helpful, please give it a star!** ⭐
