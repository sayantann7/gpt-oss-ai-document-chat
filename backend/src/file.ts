import fs from 'fs';
import pdfParse from 'pdf-parse';

interface PdfInfo {
    Title?: string;
    Author?: string;
    Subject?: string;
    Keywords?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
    [key: string]: any;
}

interface PdfMetadata extends PdfInfo { }

interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: PdfInfo;
    metadata: PdfMetadata | null;
    version: string;
    text: string;
}

export async function getPdfContent(pdfPath: string): Promise<string> {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data: PdfParseResult = await pdfParse(dataBuffer);
        return data.text;
    } catch (error) {
        console.error('Error parsing PDF:', error);
        return "";
    }
}