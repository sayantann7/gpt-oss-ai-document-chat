import dotenv from 'dotenv';
dotenv.config();

import { InferenceClient } from "@huggingface/inference";
import { createClient } from "@supabase/supabase-js";

/** Hugging Face config */
export const hfClient = new InferenceClient(process.env.HF_TOKEN);

/** Local embedding model using Transformers.js */
let embeddingPipeline: any = null;

/**
 * Initializes and retrieves the embedding pipeline using the Xenova transformers library.
 * @example
 * getEmbeddingPipeline()
 * Returns the initialized embedding pipeline object for feature extraction.
 * @async
 * @param {void} - No parameters are required for this function.
 * @returns {Promise<Object>} Returns the embedding pipeline object once initialized.
 */
export async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    try {
      // Use eval to avoid TypeScript compilation issues
      const importTransformers = new Function('return import("@xenova/transformers")');
      const transformers = await importTransformers();
      embeddingPipeline = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    } catch (error) {
      console.error('Failed to load transformers pipeline:', error);
      throw new Error('Could not initialize embedding pipeline');
    }
  }
  return embeddingPipeline;
}

/** Supabase config */
const privateKey = process.env.SUPABASE_API_KEY;
if (!privateKey) throw new Error(`Expected env var SUPABASE_API_KEY`);
const url = process.env.SUPABASE_URL;
if (!url) throw new Error(`Expected env var SUPABASE_URL`);
export const supabase = createClient(url, privateKey);