import * as vscode from 'vscode';



export function activate(context: vscode.ExtensionContext) {
	let skip = true;

	const provider = vscode.languages.registerCompletionItemProvider({scheme: 'file'}, {
		async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			// Skip every other invokation to prevent infinite loops. Looking for a better solution.
			if (skip = !skip) return [];

			const editor = vscode.window.activeTextEditor;
			const srcRange = editor?.document.getWordRangeAtPosition(position);
			if (srcRange === undefined || editor === undefined) return [];	// The editor condition is just for TypeScript sake.
			const range = new vscode.Range(srcRange.start, position);
			const word = editor.document.getText(range);

			const settings = vscode.workspace.getConfiguration('partial-autocomplete');

			const completionList: vscode.CompletionList = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, position);
			const completionTexts = completionList.items.filter(item => {
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
					.map(item => getCompletionItemText(item))
					.filter(item => item.startsWith(word));

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

function processCompletions(completions: string[], charactersCount: number = 0): string[] {
	const result: string[] = [];

	while (completions.length > 1) {	// If we are left with only one item, it means it's unique.
		const reference = completions[0];
		let chars = charactersCount + 1;
		let items: string[] = completions.filter(item => item.startsWith(reference.slice(0, chars)));
		if (items.length > 1) {
			// Loop until items divert.
			for (chars++; chars <= reference.length; chars++) {
				let new_items = items.filter(item => item.startsWith(reference.slice(0, chars)));
				if (new_items.length < items.length) break;
				items = new_items;
			}
			chars--;

			const commonPart = items[0].slice(0, chars);
			if (!items.includes(commonPart)) result.push(commonPart);
			
			const filtered = items.filter(item => item !== commonPart);
			const processed = processCompletions(filtered, chars);
			result.push(...processed);
		}
		completions = completions.filter(item => !items.includes(item));
	}

	return result;
}
