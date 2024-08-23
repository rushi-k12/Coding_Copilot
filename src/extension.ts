import * as vscode from 'vscode';
import { copilotViewProvider } from '../providers/copilotViewProvider';
import { getCodeCompletion } from '../services/togetherAIService';
import { getApiKey, validateApiKey, ensureValidApiKey } from '../config/config';

export async function activate(context: vscode.ExtensionContext) {
    const copilotProvider = new copilotViewProvider(context);

    // Ensure a valid API key is available
    const apiKey = await ensureValidApiKey();
    if (!apiKey) {
        return; // Exit activation if no valid API key is provided
    }

    // Call analyzeUserCode on activation
    copilotProvider.analyzeUserCode();
    
    // Automatically run the default chat message handling on activation
    copilotProvider.handleDefaultChatMessage();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(copilotViewProvider.viewType, copilotProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('copilot.enterApiKey', async () => {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your TogetherAi API key',
                placeHolder: 'TogetherAi API key'
            });

            if (apiKey) {
                await vscode.workspace.getConfiguration().update('copilot.apiKey', apiKey, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('API Key saved successfully!');
                await ensureValidApiKey();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.sendSelectionToChatbox', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor found.');
                return;
            }

            const selection = editor.document.getText(editor.selection);
            if (selection) {
                copilotProvider.updateChatboxInput(selection);
            } else {
                vscode.window.showInformationMessage('No text selected.');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('copilot.suggest', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const document = editor.document;
                const position = editor.selection.active;
                const startLine = Math.max(0, position.line - 15);
                const endLine = position.line;
                const codeLines = [];

                for (let i = startLine; i <= endLine; i++) {
                    codeLines.push(document.lineAt(i).text);
                }

                let codeSnippet = codeLines.join('\n').trim();

                // Get code completion from Together AI
                const response = await getCodeCompletion(codeSnippet, "mistralai/Mixtral-8x7B-Instruct-v0.1");

                // Insert the response at the cursor position
                editor.edit(editBuilder => {
                    editBuilder.insert(position, response);
                });

                // Show accept/reject options
                const accept = 'Accept';
                const reject = 'Reject';
                const userChoice = await vscode.window.showInformationMessage('Do you want to accept this suggestion?', accept, reject);

                if (userChoice === accept) {
                    // Remove the options message
                    vscode.window.showInformationMessage('Suggestion accepted.');
                } else if (userChoice === reject) {
                    // Remove the inserted suggestion
                    const endPosition = editor.selection.active;
                    const range = new vscode.Range(position, endPosition);
                    await editor.edit(editBuilder => {
                        editBuilder.delete(range);
                    });
                    vscode.window.showInformationMessage('Suggestion rejected.');
                }

            } else {
                vscode.window.showInformationMessage('No active editor found.');
            }
        })
    );
}

export function deactivate() {}
