import { MarkdownRenderer, TFile, TextFileView, WorkspaceLeaf } from "obsidian";
import * as Papa from "papaparse";

export class CSVView extends TextFileView {
	private csvData: Papa.ParseResult<unknown>;
	file: TFile;
	
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return this.file ? `${this.file.extension}-view` : "text/plain";
	}

	getIcon(): string {
		return "spreadsheet";
	}

	getDisplayText(): string {
		return this.file ? this.file.basename : "(no file)";
	}

	async renderTable(data: string): Promise<void> {
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
				const th = headerRow.createEl("th", { text: field });
				
				// Add resize handle to each header
				const resizeHandle = th.createEl("div", { cls: "resize-handle" });
				
				// Set up resize functionality
				this.setupColumnResize(resizeHandle, th);
			}
		}
		
		// Create data rows
		const tbody = table.createEl("tbody");
		if (result.data && Array.isArray(result.data)) {
			for (let rowIndex = 0; rowIndex < result.data.length; rowIndex++) {
				const row = result.data[rowIndex];
				if (typeof row === 'object' && row !== null) {
					const tr = tbody.createEl("tr");
					
					const fields = result.meta?.fields || [];
					for (let colIndex = 0; colIndex < fields.length; colIndex++) {
						const field = fields[colIndex];
						const value = (row as any)[field];
						const td = tr.createEl("td", { attr: { "data-row": rowIndex.toString(), "data-col": field } });
						
						// Create a div for editing and a div for rendering markdown
						const editableDiv = td.createEl("div", { cls: "csv-cell-edit", attr: { contenteditable: "true" } });
						editableDiv.textContent = String(value);
						
						const markdownDiv = td.createEl("div", { cls: "csv-cell-markdown" });
						
						// Use the proper context for wikilinks
						await this.renderMarkdownWithLinks(String(value), markdownDiv);
						
						// Hide the edit view initially, show markdown
						markdownDiv.style.display = "block";
						editableDiv.style.display = "none";
						
						// Add event listeners for editing/viewing toggle
						td.addEventListener("dblclick", () => {
							// Toggle between edit and view mode
							if (editableDiv.style.display === "none") {
								markdownDiv.style.display = "none";
								editableDiv.style.display = "block";
								editableDiv.focus();
							}
						});
						
						// Save changes when focus is lost
						editableDiv.addEventListener("blur", async () => {
							const newValue = editableDiv.textContent || "";
							
							// Update the CSV data
							if ((this.csvData.data as any[])[rowIndex] && (this.csvData.data as any[])[rowIndex][field] !== newValue) {
								(this.csvData.data as any[])[rowIndex][field] = newValue;
								
								// Update the markdown rendering
								markdownDiv.empty();
								await this.renderMarkdownWithLinks(newValue, markdownDiv);
								
								// Toggle back to view mode
								editableDiv.style.display = "none";
								markdownDiv.style.display = "block";
								
								// Mark the file as modified
								this.requestSave();
							}
						});
						
						// Handle keyboard shortcuts and navigation
						editableDiv.addEventListener("keydown", (e) => {
							// Enter key to finish editing
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								editableDiv.blur();
								return;
							}
							
							// Handle wikilink creation with [[
							if (e.key === '[' && e.shiftKey) {
								// Check if there's a selection
								const selection = window.getSelection();
								if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
									e.preventDefault();
									
									// Get the selected text
									const range = selection.getRangeAt(0);
									const selectedText = range.toString();
									
									// Replace the selection with [[selectedText]]
									const wikiLink = `[[${selectedText}]]`;
									
									// Use execCommand for contenteditable elements
									document.execCommand('insertText', false, wikiLink);
								}
							}
						});
					}
				}
			}
		}
		
		this.contentEl.appendChild(table);
		
		// Add some styles for the table
		const style = document.createElement("style");
		style.textContent = `
			.csv-table {
				border-collapse: collapse;
				width: 100%;
				table-layout: fixed;
			}
			.csv-table th, .csv-table td {
				border: 1px solid var(--background-modifier-border);
				padding: 6px;
				overflow: hidden;
				position: relative;
			}
			.csv-table th {
				background-color: var(--background-secondary);
				position: relative;
				user-select: none;
				min-width: 80px;
			}
			.csv-cell-edit {
				min-height: 1em;
				white-space: pre-wrap;
			}
			.csv-cell-markdown {
				min-height: 1em;
			}
			.csv-cell-markdown p {
				margin: 0;
			}
			.csv-cell-markdown .internal-link {
				color: var(--link-color);
				text-decoration: none;
			}
			.csv-cell-markdown .internal-link:hover {
				text-decoration: underline;
			}
			.resize-handle {
				position: absolute;
				right: 0;
				top: 0;
				bottom: 0;
				width: 5px;
				cursor: col-resize;
				z-index: 1;
			}
			.resize-handle:hover, .resize-handle.active {
				background-color: var(--interactive-accent);
			}
		`;
		this.contentEl.appendChild(style);
	}
	
	/**
	 * Set up column resize functionality
	 */
	setupColumnResize(resizeHandle: HTMLElement, th: HTMLElement) {
		let startX: number;
		let startWidth: number;
		let table = th.closest('table');
		let index = Array.from(th.parentElement?.children || []).indexOf(th);
		
		const startResize = (e: MouseEvent) => {
			startX = e.pageX;
			startWidth = th.offsetWidth;
			
			// Add active class
			resizeHandle.addClass('active');
			
			// Add event listeners for mousemove and mouseup
			document.addEventListener('mousemove', resize);
			document.addEventListener('mouseup', stopResize);
			
			// Prevent default to avoid text selection during resize
			e.preventDefault();
		};
		
		const resize = (e: MouseEvent) => {
			if (!table) return;
			
			// Calculate new width
			const newWidth = startWidth + (e.pageX - startX);
			
			// Set minimum width
			if (newWidth >= 50) {
				// Set the width of the column
				th.style.width = `${newWidth}px`;
				
				// Update all cells in this column to have the same width
				if (table) {
					const rows = table.querySelectorAll('tr');
					rows.forEach(row => {
						const cell = row.children[index] as HTMLElement;
						if (cell) {
							cell.style.width = `${newWidth}px`;
						}
					});
				}
			}
		};
		
		const stopResize = () => {
			// Remove active class
			resizeHandle.removeClass('active');
			
			// Remove event listeners
			document.removeEventListener('mousemove', resize);
			document.removeEventListener('mouseup', stopResize);
		};
		
		// Attach mousedown event listener to the resize handle
		resizeHandle.addEventListener('mousedown', startResize);
	}
	
	/**
	 * Renders markdown with proper handling of wikilinks
	 */
	async renderMarkdownWithLinks(text: string, element: HTMLElement): Promise<void> {
		// The sourceParent parameter (this) ensures proper context for resolving links
		await MarkdownRenderer.renderMarkdown(
			text, 
			element, 
			this.file ? this.file.path : '', 
			this
		);

		// Add click handlers for internal links to make them work properly
		const links = element.querySelectorAll('.internal-link');
		links.forEach((link) => {
			link.addEventListener('click', (event) => {
				event.preventDefault();
				
				// Get the target file path from the link
				const targetPath = link.getAttribute('data-href') || '';
				if (targetPath) {
					// Open the linked file in a new leaf
					this.app.workspace.openLinkText(
						targetPath,
						this.file ? this.file.path : '',
						event.ctrlKey || event.metaKey // Open in new pane if Ctrl/Cmd is pressed
					);
				}
			});
		});
	}

	getViewData(): string {
		if (this.csvData && this.csvData.data) {
			return Papa.unparse(this.csvData.data);
		}
		return "";
	}

	setViewData(data: string, clear: boolean): void {
		this.renderTable(data);
	}

	clear(): void {
		this.contentEl.empty();
	}
}