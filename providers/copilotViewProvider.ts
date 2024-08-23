// providers/copilotprovider.ts
import * as vscode from 'vscode';
import { MessageHandler } from './messageHandler';
import { Utils } from '../utils/utils';

export class copilotViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'copilot.sidebar';
    private _view?: vscode.WebviewView;
    public messageHandler?: MessageHandler;
    public utils?: Utils;

    constructor(private readonly context: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        this.messageHandler = new MessageHandler(webviewView);
        this.utils = new Utils(this.context, webviewView);

        webviewView.webview.options = {
            enableScripts: true,
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Listen to messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (this.messageHandler) {
                const selectedModel = message.model;
                await this.messageHandler.handleMessage(message, selectedModel);
            }
        });
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
                    <div id="chat-box" class="chat-box"></div>
                    <div class="input-container">
                        <textarea id="chat-input" class="chat-textarea" rows="1" placeholder="Let's chat..."></textarea>
                        <div class="input-row">
                            <select id="model" class="api-key-dropdown">
                                <option value="mistralai/Mixtral-8x7B-Instruct-v0.1">Mistral AI 8x7b v0.1</option>
                                <option value="mistralai/Mistral-7B-Instruct-v0.2">Mistrail AI 7b v0.2</option>
                                <option value="codellama/CodeLlama-13b-Instruct-hf">Code llama 13b</option>
                                <!-- Add more options as needed -->
                            </select>
                            <img id="send-icon" class="send-icon" src="${sendIconUri}" alt="Send" />
                        </div>
                    </div>
                </div>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/prism.min.js"></script>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}
