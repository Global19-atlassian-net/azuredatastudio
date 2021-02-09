/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import { pathExists, remove } from 'fs-extra';
import * as loc from '../common/localizedConstants';
import { IconPathHelper } from '../common/iconHelper';
import { BookTocManager } from '../book/bookTocManager';
import { confirmReplace } from '../common/utils';
import { IPrompter } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';

export class CreateBookDialog {

	private dialog: azdata.window.Dialog;
	public view: azdata.ModelView;
	private formModel: azdata.FormContainer;
	private groupNameInputBox: azdata.InputBoxComponent;
	private locationInputBox: azdata.InputBoxComponent;
	private notebooksLocationInputBox: azdata.InputBoxComponent;
	public saveLocation: string = '';
	public contentFolder: string = '';
	public tocManager: BookTocManager;
	private prompter: IPrompter;

	constructor(toc: BookTocManager) {
		this.tocManager = toc;
		this.prompter = new CodeAdapter();
	}

	protected createHorizontalContainer(view: azdata.ModelView, items: azdata.Component[]): azdata.FlexContainer {
		return view.modelBuilder.flexContainer().withItems(items, { CSSStyles: { 'margin-right': '10px', 'margin-bottom': '10px' } }).withLayout({ flexFlow: 'row' }).component();
	}

	public async selectFolder(): Promise<string> {
		const allFilesFilter = loc.allFiles;
		let filter: any = {};
		filter[allFilesFilter] = '*';
		let uris = await vscode.window.showOpenDialog({
			filters: filter,
			canSelectFiles: false,
			canSelectMany: false,
			canSelectFolders: true,
			openLabel: loc.labelSelectFolder
		});
		if (uris && uris.length > 0) {
			const pickedFolder = uris[0];
			const destinationUri = path.join(pickedFolder.fsPath, path.basename(this.groupNameInputBox.value));
			if (destinationUri) {
				if (await pathExists(destinationUri)) {
					let doReplace = await confirmReplace(this.prompter);
					if (!doReplace) {
						return undefined;
					}
					else {
						//remove folder if exists
						await remove(destinationUri);
					}
				}
				return pickedFolder.fsPath;
			}
		}
		return undefined;
	}

	public async createDialog(): Promise<void> {
		this.dialog = azdata.window.createModelViewDialog(loc.newGroup);
		this.dialog.registerContent(async view => {
			this.view = view;

			const groupLabel = this.view.modelBuilder.text()
				.withProperties({
					value: loc.groupDescription,
					CSSStyles: { 'margin-bottom': '0px', 'margin-top': '0px', 'font-size': 'small' }
				}).component();

			this.groupNameInputBox = this.view.modelBuilder.inputBox()
				.withProperties({
					values: [],
					value: '',
					enabled: true
				}).component();

			this.locationInputBox = this.view.modelBuilder.inputBox().withProperties({
				values: [],
				value: '',
				placeHolder: loc.locationBrowser,
				width: '400px'
			}).component();

			this.notebooksLocationInputBox = this.view.modelBuilder.inputBox().withProperties({
				values: [],
				value: '',
				placeHolder: loc.selectContentFolder,
				width: '400px'
			}).component();

			const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				ariaLabel: loc.browse,
				iconPath: IconPathHelper.folder,
				width: '18px',
				height: '20px',
			}).component();

			const browseContentFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
				ariaLabel: loc.browse,
				iconPath: IconPathHelper.folder,
				width: '18px',
				height: '20px',
			}).component();

			browseFolderButton.onDidClick(async () => {
				this.saveLocation = await this.selectFolder();
				this.locationInputBox.value = this.saveLocation;
			});

			browseContentFolderButton.onDidClick(async () => {
				this.contentFolder = await this.selectFolder();
				this.notebooksLocationInputBox.value = this.contentFolder;
			});

			this.formModel = this.view.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: groupLabel,
							required: false
						},
						{
							component: this.groupNameInputBox,
							title: loc.name,
							required: true
						},
						{
							title: loc.saveLocation,
							required: true,
							component: this.createHorizontalContainer(view, [this.locationInputBox, browseFolderButton])
						},
						{
							title: loc.contentFolder,
							required: false,
							component: this.createHorizontalContainer(view, [this.notebooksLocationInputBox, browseContentFolderButton])
						},
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await this.view.initializeModel(this.formModel);
		});
		this.dialog.okButton.label = loc.create;
		this.dialog.okButton.onClick(() => {
			this.saveLocation = this.locationInputBox.value;
			this.contentFolder = this.notebooksLocationInputBox.value;
		});

		this.dialog.cancelButton.label = loc.cancel;
		this.dialog.registerCloseValidator(async () => await this.create());
		azdata.window.openDialog(this.dialog);
	}

	private async create(): Promise<boolean> {
		try {
			const bookPath = path.join(this.saveLocation, this.groupNameInputBox.value);
			await this.tocManager.createBook(bookPath, this.contentFolder);
			return true;
		} catch (error) {
			return false;
		}
	}
}
