import * as vscode from 'vscode';



export function activate(context: vscode.ExtensionContext) {
	let skip = false;

	const provider = vscode.languages.registerCompletionItemProvider({scheme: 'file'}, {
		async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			// Skip every other invokation to prevent infinite loops. Looking for a better solution.
			skip = !skip;
			if (!skip) return [];

			const editor = vscode.window.activeTextEditor;
			if (editor === undefined) return [];

			const srcRange = editor.document.getWordRangeAtPosition(position);
			if (srcRange === undefined) return [];
			const range = new vscode.Range(srcRange.start, position);
			const word = editor.document.getText(range);

			const settings = vscode.workspace.getConfiguration('partial-autocomplete');

			const completionList: vscode.CompletionList = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, position);
			const completionTexts = completionList.items.filter(item => {
														const kind = item.kind;
														return kind == vscode.CompletionItemKind.Class && settings.get('includeCompletionItemKindClass') ||
															kind == vscode.CompletionItemKind.Color && settings.get('includeCompletionItemKindColor') ||
															kind == vscode.CompletionItemKind.Constant && settings.get('includeCompletionItemKindConstant') ||
															kind == vscode.CompletionItemKind.Constructor && settings.get('includeCompletionItemKindConstructor') ||
															kind == vscode.CompletionItemKind.Enum && settings.get('includeCompletionItemKindEnum') ||
															kind == vscode.CompletionItemKind.EnumMember && settings.get('includeCompletionItemKindEnumMember') ||
															kind == vscode.CompletionItemKind.Event && settings.get('includeCompletionItemKindEvent') ||
															kind == vscode.CompletionItemKind.Field && settings.get('includeCompletionItemKindField') ||
															kind == vscode.CompletionItemKind.File && settings.get('includeCompletionItemKindFile') ||
															kind == vscode.CompletionItemKind.Folder && settings.get('includeCompletionItemKindFolder') ||
															kind == vscode.CompletionItemKind.Function && settings.get('includeCompletionItemKindFunction') ||
															kind == vscode.CompletionItemKind.Interface && settings.get('includeCompletionItemKindInterface') ||
															kind == vscode.CompletionItemKind.Issue && settings.get('includeCompletionItemKindIssue') ||
															kind == vscode.CompletionItemKind.Keyword && settings.get('includeCompletionItemKindKeyword') ||
															kind == vscode.CompletionItemKind.Method && settings.get('includeCompletionItemKindMethod') ||
															kind == vscode.CompletionItemKind.Module && settings.get('includeCompletionItemKindModule') ||
															kind == vscode.CompletionItemKind.Operator && settings.get('includeCompletionItemKindOperator') ||
															kind == vscode.CompletionItemKind.Property && settings.get('includeCompletionItemKindProperty') ||
															kind == vscode.CompletionItemKind.Reference && settings.get('includeCompletionItemKindReference') ||
															kind == vscode.CompletionItemKind.Snippet && settings.get('includeCompletionItemKindSnippet') ||
															kind == vscode.CompletionItemKind.Struct && settings.get('includeCompletionItemKindStruct') ||
															kind == vscode.CompletionItemKind.Text && settings.get('includeCompletionItemKindText') ||
															kind == vscode.CompletionItemKind.TypeParameter && settings.get('includeCompletionItemKindTypeParameter') ||
															kind == vscode.CompletionItemKind.Unit && settings.get('includeCompletionItemKindUnit') ||
															kind == vscode.CompletionItemKind.User && settings.get('includeCompletionItemKindUser') ||
															kind == vscode.CompletionItemKind.Value && settings.get('includeCompletionItemKindValue') ||
															kind == vscode.CompletionItemKind.Variable && settings.get('includeCompletionItemKindVariable');
													})
													.map(item => {
														if (item.insertText instanceof vscode.SnippetString) {
															return item.insertText.value;
														}
														else {
															return item.insertText ?? item.label.toString();
														}
													})
													.filter(item => item.startsWith(word));

			const processed = processNode(completionTexts).filter(item => item !== word);
			
			const completions = processed.map(item => {
					let completion = new vscode.CompletionItem(item);
					completion.sortText = ' ';
					completion.detail = ':partial';
					completion.kind = settings.get('completionItemKind');
					completion.command = { command: 'editor.action.triggerSuggest', title: 'Trigger Suggest' };
					return completion;
				});
			return completions;
		}
	});

	context.subscriptions.push(provider);
}



function processNode(node: string[], chars: number = 0): string[] {
	const result: string[] = [];

	if (node.length > 1) {
		const initialChars = chars;
		while (node.length > 0) {
			const reference = node[0];
			chars = initialChars + 1;
			let items: string[] = node.filter(item => item.startsWith(reference.slice(0, chars)));
			chars += 1;
			for (; chars <= reference.length && items.length > 1; chars++) {
				let new_items = items.filter(item => item.startsWith(reference.slice(0, chars)));
				if (new_items.length < items.length) {
					break;
				}
				items = new_items;
			}
			chars -= 1;
			node = node.filter(item => !items.includes(item));

			const tag = items.length > 1 ? items[0].slice(0, chars) : reference;
			if (!items.includes(tag)) {
				result.push(tag);
			}
			items = items.filter(item => item !== tag);
			const processed = processNode(items, chars);
			for (let item of processed) {
				result.push(item);
			}
		}
	}

	return result;
}
