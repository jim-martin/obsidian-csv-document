import { TFile, TextFileView, WorkspaceLeaf } from "obsidian";
import * as Papa from "papaparse";

export class CSVView extends TextFileView {
	private csvData: Papa.ParseResult<unknown>;
	file: TFile;
	
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	/**
	 * Gets the type of this view.
	 * We use `extension-view`, where extension is the file extension.
	 * This is also used in main.ts, where the view types are registered and deregistered.
	 *
	 * @returns The view-type constructed fron the file extension if it exists, otherwise "text/plain".
	 */
	getViewType(): string {
		return this.file ? `${this.file.extension}-view` : "text/plain";
	}

	/**
	 * A string identifier of the Lucide icon that is shown in the tab of this view.
	 * We use "file-code".
	 *
	 * @returns The string "file-code".
	 */
	getIcon(): string {
		return "spreadsheet";
	}

	/**
	 * Gets the text to display in the header of the tab.
	 * This is the filename if it exists.
	 *
	 * @returns The filename if it exists, otherwise "(no file)".
	 */
	getDisplayText(): string {
		return this.file ? this.file.basename : "(no file)";
	}

	/**
	 * Renders the CSV data as a simple HTML table
	 * 
	 * @param data CSV string to render
	 */
	renderTable(data: string): void {
		this.contentEl.empty();
		
		const result = Papa.parse(data, {
			header: true,
			skipEmptyLines: true
		});
		
		this.csvData = result;
		
		const table = document.createElement("table");
		table.addClass("csv-table");
		
		// Create header row
		if (result.meta && result.meta.fields) {
			const thead = table.createEl("thead");
			const headerRow = thead.createEl("tr");
			
			for (const field of result.meta.fields) {
				headerRow.createEl("th", { text: field });
			}
		}
		
		// Create data rows
		const tbody = table.createEl("tbody");
		if (result.data && Array.isArray(result.data)) {
			for (const row of result.data) {
				if (typeof row === 'object' && row !== null) {
					const tr = tbody.createEl("tr");
					
					for (const field of Object.values(row)) {
						tr.createEl("td", { text: String(field) });
					}
				}
			}
		}
		
		this.contentEl.appendChild(table);
	}

	/**
	 * Gets the data from the editor.
	 * This will be called to save the editor contents to the file.
	 *
	 * @returns A string representing the content of the editor.
	 */
	getViewData(): string {
		// If we have parsed CSV data, unparse it back to a string
		if (this.csvData && this.csvData.data) {
			return Papa.unparse(this.csvData.data);
		}
		return "";
	}

	/**
	 * Set the data to the editor.
	 * This is used to load the file contents.
	 *
	 * @param data data to load
	 * @param clear whether or not to clear the editor
	 */
	setViewData(data: string, clear: boolean): void {
		this.renderTable(data);
	}

	/**
	 * Clear the editor.
	 *
	 * This is called when we're about to open a completely different file,
	 * so it's best to clear any editor states like undo-redo history,
	 * and any caches/indexes associated with the previous file contents.
	 */
	clear(): void {
		this.contentEl.empty();
	}
}