// main.ts
import { Plugin } from 'obsidian';
import { CSVView } from './csv-view';

const CSV_VIEW_TYPE = 'csv view'

export default class CSVEditorPlugin extends Plugin {
  async onload() {
    // Register the CSV view
    this.registerView(
      CSV_VIEW_TYPE,
      (leaf) => new CSVView(leaf)
    );

    // Register an extension handler to open CSV files with our view
    this.registerExtensions(['csv'], CSV_VIEW_TYPE);
  }

  async onunload() {
    // Clean up by detaching all leaves of our type
    this.app.workspace.detachLeavesOfType(CSV_VIEW_TYPE);
  }
}