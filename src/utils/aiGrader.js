import { GoogleGenerativeAI } from '@google/generative-ai';

const GRADER_PROMPT = (targetWord, definition, userSentence) =>
    `You are a strict IELTS examiner. Grade this user's sentence. Target Word: "${targetWord}" (Definition: ${definition}). User Sentence: "${userSentence}".
Rules: 1. It must make logical sense. 2. It must be grammatically correct (right part of speech). 3. It must have enough context to prove they understand the word (fail short sentences like "He is a catalyst").
Return ONLY a raw JSON object with no markdown formatting or backticks. Format: {"isCorrect": true/false, "feedback": "1-2 short sentences explaining why they passed or failed", "improvedVersion": "A Band-9 IELTS version of their sentence if they passed, or a corrected version if they failed"}`;

const parseResponse = (text) => {
    let clean = text.trim();
    if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(clean);
};

export const gradeSentence = async (targetWord, definition, userSentence) => {
    const prompt = GRADER_PROMPT(targetWord, definition, userSentence);

    try {
        const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY_DOJO);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        return parseResponse(result.response.text());
    } catch (primaryError) {
        console.warn('aiGrader primary key failed:', primaryError.message);

        const isQuota =
            primaryError.status === 429 ||
            primaryError.message?.toLowerCase().includes('429') ||
            primaryError.message?.toLowerCase().includes('quota');

        if (isQuota) {
            try {
                const fallbackGenAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY_DOJO_2);
                const fallbackModel = fallbackGenAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const fallbackResult = await fallbackModel.generateContent(prompt);
                return parseResponse(fallbackResult.response.text());
            } catch (fallbackError) {
                console.error('aiGrader fallback key failed:', fallbackError);
                throw new Error('The grading AI is currently resting. Please try again in a moment.');
            }
        }

        throw new Error('Failed to connect to grading server. Please try again.');
    }
};
