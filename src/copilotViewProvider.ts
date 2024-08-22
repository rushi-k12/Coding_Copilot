import * as vscode from 'vscode';
import Together from 'together-ai';
import * as dotenv from 'dotenv';
import { CodeAnalyzer, FunctionInfo } from './codeAnalyzer';
import { getChatCompletion, getCodeCompletion } from './togetherAIService';
dotenv.config();

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY || vscode.workspace.getConfiguration().get('copilot.apiKey') ;
const together = new Together({ apiKey: TOGETHER_API_KEY });

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class copilotViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'copilot.sidebar';
    private _view?: vscode.WebviewView;
    private conversationHistory: ChatMessage[] = [];
    
    constructor(private readonly context: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Listen to messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'sendMessage') {
                const userMessage = message.text;
                const selectedModel = message.model;
                let systemContent = '';
                
                // Add user message to conversation history
                this.conversationHistory.push({ role: 'user', content: userMessage });
                
                try {
                    // Parse the command
                    const commandMatch = userMessage.match(/^\/(\w+)\s+([\s\S]*)/);
                    if (commandMatch) {
                        const command = commandMatch[1];
                        const code = commandMatch[2];

                        if (command === 'suggest') {
                                
                                // Get code completion from Together AI
                                const response = await getCodeCompletion(code, selectedModel);
                                console.log('Response from Together AI:', response);

                                // Send the bot's response back to the webview
                                webviewView.webview.postMessage({
                                    command: 'receiveMessage',
                                    botResponse: response,
                                });
                            
                        } else {
                            if (command === 'comment') { 
                                    systemContent = `You are a helpful AI programming assistant specialized in commenting code. Always return the user's code as a single code block with comments added to it. Ensure that:
                                1. The entire response is enclosed within a single code block.
                                2. The code block starts with \`\`\` followed by the appropriate language identifier.
                                3. All comments are clearly inserted within the code.

                                Provide comments directly within the code block. Do not include any text outside the code block.`;

                                } else if (command === 'debug') {
                                    systemContent = `You are a helpful AI programming assistant specialized in debugging code. Your job is to carefully review the code, debug it, and return the user's code, properly debugged, in a single code block. Ensure that:
                                1. The entire response is within a single code block.
                                2. The code block starts with \`\`\` followed by the appropriate language identifier.
                                3. Explain the errors and fixes within comments inside the code block.

                                Do not include any text outside the code block.`;

                                } else if (command === 'refactor') {
                                    systemContent = `You are a helpful AI programming assistant specialized in refactoring code. Your job is to carefully review the given code and output the properly refactored code in a single code block. Ensure that:
                                1. The entire response is within a single code block.
                                2. The code block starts with \`\`\` followed by the appropriate language identifier.
                                3. Apply proper design patterns, improve performance, and follow coding principles.

                                All explanations should be within the code block as comments. Do not include any text outside the code block.`;

                                } else {
                                    systemContent = `You are a helpful specialized AI programming assistant. Follow the user's requirements carefully and respond with code blocks. If providing explanations, include them as comments within the code block.`;
                                }


                            // Get chat completion from Together AI
                            const chatCompletion = await getChatCompletion([
                                {
                                    role: 'system',
                                    content: systemContent
                                },
                                {
                                    role: 'user',
                                    content: code
                                }
                            ], selectedModel);

                            // Add bot response to conversation history
                            this.conversationHistory.push({ role: 'assistant', content: chatCompletion });

                            // Send the bot's response back to the webview
                            webviewView.webview.postMessage({
                                command: 'receiveMessage',
                                botResponse: chatCompletion,
                            });
                        }
                    } else {
                        
                        systemContent = `You are a helpful specialized AI programming assistant and conversational expert. 
                            - Return the greetings or responses with the emojis.-Don't provide confidence in your answers. 
                            - Listen to the User's inputs carefully and respond based on that. 
                            - Don't assume anything. If you are confused or unaware about something, ask questions to the user to provide them with a proper response. 
                            - Always talk to your user as if you are talking to someone. 
                            - Follow the user's requirements carefully and to the letter. 
                            - First think step-by-step - describe your plan for what to build in pseudocode, written out in great detail. 
                            - Then output the code in a single code block. - Minimize any other prose. - Wait for the user's instruction. 
                            - Respond in multiple responses/messages so your responses aren't cut off.`;
                        // Handle normal chat messages without specific commands
                        const chatCompletion = await getChatCompletion([
                            {
                                role: 'system',
                                content: systemContent
                            },
                            ...this.conversationHistory,  // Include conversation history
                            {
                                role: 'user',
                                content: userMessage || 'Hi, greet me with an emoji.'
                            }
                        ], selectedModel);

                        // Add bot response to conversation history
                        this.conversationHistory.push({ role: 'assistant', content: chatCompletion });

                        // Send the bot's response back to the webview
                        webviewView.webview.postMessage({
                            command: 'receiveMessage',
                            botResponse: chatCompletion,
                        });
                    }
                } catch (error) {
                    vscode.window.showErrorMessage('Error getting response from Together AI');
                }
                                
            } else if (message.command === 'moveCodeToCursor') {
                const code = message.code;
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, code);
                    });
                }
            }
        });
    }
    
    // Add this method to the copilotViewProvider class
    public async handleDefaultChatMessage() {
        
    const systemContent = `Introduce yourself`;
    
    const introductoryMessage = `
Hi there! I’m your AI coding assistant, here to help you with all your programming needs. Whether you need code suggestions, debugging assistance, refactoring tips, or just some guidance on best practices, I’m here to support you. 😊 You can use the following commands to get specific help: /comment to add comments to your code, /debug to debug your code, /refactor to refactor your code, and /suggest to get code suggestions or use the shortcut in your editor. Here are some handy keybindings to make things even easier: Send Selection to Chatbox with Ctrl + Alt + S and Get Code Suggestion with Ctrl + Shift + S. Just let me know what you need, and I’ll do my best to assist you! 🚀 Happy coding! 💻
`;


    const chatCompletion = await getChatCompletion([
        {
            role: 'system',
            content: systemContent
        },
        {
            role: 'assistant',
            content: introductoryMessage
        }
    ], 'mistralai/Mixtral-8x7B-Instruct-v0.1');

    // Add bot response to conversation history
    this.conversationHistory.push({ role: 'assistant', content: chatCompletion });

    // Send the bot's response back to the webview
    if (this._view) {
        this._view.webview.postMessage({
            command: 'receiveMessage',
            botResponse: chatCompletion,
        });
    }
}

    
    public async analyzeUserCode() {
        const files = await vscode.workspace.findFiles('**/*.{ts,js,jsx}', '**/node_modules/**');
        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            const code = document.getText();
            const analyzer = new CodeAnalyzer(code);
            const functionInfos = analyzer.analyzeFunctions();

            // Add analysis result to conversation history
            this.addSystemMessage(`This is user's codebase for  ${file.fsPath}:\n${JSON.stringify(functionInfos, null, 2)}. You are being provided with this codebase to make you aware of the context of code, in case you are asked questions by the user from the codebase.`);
        }

        
    }

    public addSystemMessage(content: string) {
        this.conversationHistory.push({ role: 'system', content });
    }
    
    public updateChatboxInput(text: string) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateInput',
                text: text
            });
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles.css'));
        const sendIconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'submit-icon.svg'));
        
        return `
            <!DOCTYPE html>
            <html lang="en">

            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/themes/prism-tomorrow.min.css" rel="stylesheet">
            <title>Copilot</title>
            </head>

            <body>
            <div class="chat-container">
                <div id="chat-box" class=k></div>
                <div class="input-container">
                <textarea id="chat-input" class="chat-textarea" rows="1" placeholder="Let's chat..."></textarea>
                <div class="input-row">
                    <select id="model" class="api-key-dropdown">
                        <option value="mistralai/Mixtral-8x7B-Instruct-v0.1">Mistral AI </option>
                        <option value="codellama/CodeLlama-13b-Instruct-hf">Code llama - Python</option>
                        <option value="google/gemma-7b-it">Google Gemma</option>
                        <!-- Add more options as needed -->
                    </select>
                    <img id="send-icon" class="send-icon" src="${sendIconUri}" alt="Send" />
                </div>
                </div>
            </div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/prism.min.js"> </script>
            <script src="${scriptUri}"></script>
            </body>

            </html>
        `;
    }
}



