// server.js

import express from 'express';
import { storeChatHistory, getSimilarChats } from './backend.js';

const app = express();
app.use(express.json());

// Route to store chat history
app.post('/store-chat', async (req, res) => {
    const { text, metadata } = req.body;
    await storeChatHistory(text, metadata);
    res.status(200).send('Chat history stored successfully.');
});

// Route to retrieve similar chat history
app.post('/get-similar-chats', async (req, res) => {
    const { query, numResults } = req.body;
    const results = await getSimilarChats(query, numResults);
    res.status(200).json(results);
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
