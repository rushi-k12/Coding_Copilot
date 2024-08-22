import Together from 'together-ai';
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
dotenv.config();

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY || vscode.workspace.getConfiguration().get('copilot.apiKey');
const together = new Together({ apiKey: TOGETHER_API_KEY });

export async function getChatCompletion(messages: any[], model: string): Promise<string> {
    try {
        const response = await together.chat.completions.create({
            messages: messages,
            model: model,
        });

        return response.choices[0].message?.content || "Sorry, I didn't understand that.";
    } catch (error) {
        vscode.window.showErrorMessage('Error getting response from Together AI');
        return "Sorry, I couldn't complete the request.";
    }
}

export async function getCodeCompletion(prompt: string, model: string): Promise<string> {
    try {
        const response = await together.completions.create({
            model: model,
            prompt: prompt,
            stop: ["/"],
            temperature: 0.3,
            top_p: 0.9,
            stream: true
        });

        let completion = '';
        for await (const chunk of response) {
            completion += chunk.choices[0].text;
        }
        return completion;
    } catch (error) {
        console.log(error);
        vscode.window.showErrorMessage('Error getting response from Together AI');
        return "Sorry, I couldn't complete the code.";
    }
}
