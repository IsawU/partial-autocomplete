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

			const completionList: vscode.CompletionList = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, position);
			const completionTexts = completionList.items.map(item => {
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
					completion.kind = vscode.CompletionItemKind.Snippet;
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
