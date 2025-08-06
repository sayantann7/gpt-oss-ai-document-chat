// Test script to demonstrate the new optimized few-shot examples function
const { createFewShotExamplesOptimized } = require('./dist/index.js');
const { getPdfContent } = require('./dist/file.js');

async function testOptimizedFunction() {
    console.log('Testing the new optimized few-shot examples function...');
    
    try {
        // Load PDF content
        const pdfPath = 'bajaj-2.pdf';
        const pdfContent = await getPdfContent(pdfPath);
        
        if (!pdfContent) {
            console.error('Could not extract PDF content');
            return;
        }
        
        console.log(`PDF content length: ${pdfContent.length} characters`);
        console.log(`Estimated tokens: ${Math.ceil(pdfContent.length / 4)}`);
        
        // Test the optimized function
        const documentName = pdfPath;
        const startTime = Date.now();
        
        const fewShotExamples = await createFewShotExamplesOptimized(pdfContent, documentName);
        
        const endTime = Date.now();
        const processingTime = (endTime - startTime) / 1000;
        
        console.log(`\nProcessing completed in ${processingTime} seconds`);
        console.log('\nGenerated Few-Shot Examples:');
        console.log('=' .repeat(50));
        console.log(fewShotExamples);
        console.log('=' .repeat(50));
        
    } catch (error) {
        console.error('Error testing optimized function:', error);
    }
}

// Run the test
testOptimizedFunction();
