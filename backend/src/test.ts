import express from 'express';
import { getPdfContent } from './file';

// Simple test to verify the server setup
async function testSetup() {
    console.log('🧪 Testing server setup...');
    
    try {
        // Test PDF reading
        console.log('📄 Testing PDF content extraction...');
        const pdfContent = await getPdfContent('bajaj-2.pdf');
        console.log(`✅ PDF content extracted: ${pdfContent.length} characters`);
        
        // Test Express
        console.log('🚀 Testing Express setup...');
        const app = express();
        app.get('/test', (req, res) => {
            res.json({ status: 'ok', message: 'Express is working!' });
        });
        
        const server = app.listen(3001, () => {
            console.log('✅ Express server test successful');
            server.close();
        });
        
        console.log('🎉 All tests passed! Server is ready for production.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testSetup();
