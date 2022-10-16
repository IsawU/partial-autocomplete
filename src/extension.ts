import * as vscode from 'vscode';


export function activate(context: vscode.ExtensionContext) {
	var skipInvocation = false;

	const provider = vscode.languages.registerCompletionItemProvider({scheme: 'file'}, {
		async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			// It would be for the best if we could provide our own context.triggerKind.
			if (skipInvocation) return [];

			if (token.isCancellationRequested) return [];

			const editor = vscode.window.activeTextEditor;
			const srcRange = editor?.document.getWordRangeAtPosition(position);
			if (srcRange === undefined || editor === undefined) return [];	// The editor condition is just for TypeScript sake.
			const range = new vscode.Range(srcRange.start, position);
			const word = editor.document.getText(range);

			if (token.isCancellationRequested) return [];

			const settings = vscode.workspace.getConfiguration('partial-autocomplete');

			skipInvocation = true;	// We need to prevent self invocation to avoid infinite loop.
			const completionList: vscode.CompletionList = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, position);
			skipInvocation = false;
			const completionTexts = completionList.items.filter((item: vscode.CompletionItem) => {
						const kind = item.kind;
						return kind === undefined ||
							kind === vscode.CompletionItemKind.Class && settings.get('includeCompletionItemKindClass', true) ||
							kind === vscode.CompletionItemKind.Color && settings.get('includeCompletionItemKindColor', false) ||
							kind === vscode.CompletionItemKind.Constant && settings.get('includeCompletionItemKindConstant', true) ||
							kind === vscode.CompletionItemKind.Constructor && settings.get('includeCompletionItemKindConstructor', true) ||
							kind === vscode.CompletionItemKind.Enum && settings.get('includeCompletionItemKindEnum', true) ||
							kind === vscode.CompletionItemKind.EnumMember && settings.get('includeCompletionItemKindEnumMember', true) ||
							kind === vscode.CompletionItemKind.Event && settings.get('includeCompletionItemKindEvent', false) ||
							kind === vscode.CompletionItemKind.Field && settings.get('includeCompletionItemKindField', true) ||
							kind === vscode.CompletionItemKind.File && settings.get('includeCompletionItemKindFile', true) ||
							kind === vscode.CompletionItemKind.Folder && settings.get('includeCompletionItemKindFolder', true) ||
							kind === vscode.CompletionItemKind.Function && settings.get('includeCompletionItemKindFunction', true) ||
							kind === vscode.CompletionItemKind.Interface && settings.get('includeCompletionItemKindInterface', true) ||
							kind === vscode.CompletionItemKind.Issue && settings.get('includeCompletionItemKindIssue', false) ||
							kind === vscode.CompletionItemKind.Keyword && settings.get('includeCompletionItemKindKeyword', true) ||
							kind === vscode.CompletionItemKind.Method && settings.get('includeCompletionItemKindMethod', true) ||
							kind === vscode.CompletionItemKind.Module && settings.get('includeCompletionItemKindModule', true) ||
							kind === vscode.CompletionItemKind.Operator && settings.get('includeCompletionItemKindOperator', false) ||
							kind === vscode.CompletionItemKind.Property && settings.get('includeCompletionItemKindProperty', true) ||
							kind === vscode.CompletionItemKind.Reference && settings.get('includeCompletionItemKindReference', true) ||
							kind === vscode.CompletionItemKind.Snippet && settings.get('includeCompletionItemKindSnippet', false) ||
							kind === vscode.CompletionItemKind.Struct && settings.get('includeCompletionItemKindStruct', true) ||
							kind === vscode.CompletionItemKind.Text && settings.get('includeCompletionItemKindText', false) ||
							kind === vscode.CompletionItemKind.TypeParameter && settings.get('includeCompletionItemKindTypeParameter', false) ||
							kind === vscode.CompletionItemKind.Unit && settings.get('includeCompletionItemKindUnit', false) ||
							kind === vscode.CompletionItemKind.User && settings.get('includeCompletionItemKindUser', false) ||
							kind === vscode.CompletionItemKind.Value && settings.get('includeCompletionItemKindValue', false) ||
							kind === vscode.CompletionItemKind.Variable && settings.get('includeCompletionItemKindVariable', true);
					})
					.map((item: vscode.CompletionItem) => getCompletionItemText(item))
					.filter((item: string) => item.startsWith(word));

			if (token.isCancellationRequested) return [];

			const completions = processCompletions(completionTexts)
					.filter(item => item !== word)
					.map(item => {
						const completion = new vscode.CompletionItem({label: item, detail: '…', description: 'partial'});
						completion.sortText = settings.get('completionItemSortString', ' ');
						completion.kind = settings.get('completionItemKind');
						completion.command = { command: 'editor.action.triggerSuggest', title: 'Trigger Suggest' };
						return completion;
					});
			return completions;
		}
	});

	context.subscriptions.push(provider);
}


function getCompletionItemText(completion: vscode.CompletionItem): string {
	if (completion.insertText !== undefined) {
		if (completion.insertText instanceof vscode.SnippetString) {
			return completion.insertText.value;
		}
		else {
			return completion.insertText;
		}
	}
	else {
		if (typeof completion.label == 'object') {
			return completion.label.label;
		}
		else {
			return completion.label;
		}
	}
}

function processCompletions(completions: string[], startCharacter: number = 1): string[] {
	const result: string[] = [];

	if (completions.length > 1) {
		for (let character = startCharacter; character <= completions[0].length; ++character) {
			const commonPart = completions[0].slice(0, character);
			const differs = completions.find(item => !item.startsWith(commonPart));
			if (differs != null) {
				// commonPart now contains common substring + 1 character,
				// but if we just started, we already have this substring.
				if (character != startCharacter) {
					const commonSubstring = commonPart.slice(0, -1);
					result.push(commonSubstring);
				}
				// Process all the differing items recursively.
				const differingCompletions = completions.filter(item => !item.startsWith(commonPart));
				const processed = processCompletions(differingCompletions, commonPart.length);
				result.push(...processed);
				// Remove completions processed recursively.
				completions = completions.filter(item => item.startsWith(commonPart));
			}
			else if (character == completions[0].length) {
				result.push(completions[0]);
				// Remove the current reference.
				completions = completions.slice(1);
				// Adjust start character. Avoids duplicates when we have
				// multiple branches just beyond our original reference word.
				startCharacter = character + 1;
			}
			// If we are left with one completion, we are done.
			if (completions.length <= 1) break;
		}
	}

	return result;
}
