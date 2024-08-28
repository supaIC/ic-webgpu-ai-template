// backend.js

import embeddings from "@themaximalist/embeddings.js";
import VectorDB from "@themaximalist/vectordb.js";

// Initialize the vector database with appropriate dimensions
const db = new VectorDB({
    dimensions: 384, // Local embeddings dimension
    size: 100,       // Initial size of the database
});

// Function to store chat history in the vector database
export async function storeChatHistory(text, metadata = {}) {
    try {
        const embedding = await embeddings(text);
        await db.add(text, { ...metadata, timestamp: Date.now() });
    } catch (error) {
        console.error('Error storing chat history:', error);
    }
}

// Function to retrieve similar chat history
export async function getSimilarChats(query, numResults = 3) {
    try {
        const results = await db.search(query, numResults);
        return results.map(result => result.input); // Return only the text input for simplicity
    } catch (error) {
        console.error('Error retrieving similar chats:', error);
        return [];
    }
}
