import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormArray, FormControl } from '@angular/forms';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib'; 
import { CloudAppSettingsService } from '@exlibris/exl-cloudapp-angular-lib'; 
import { AVAILABLE_FIELDS } from '../main/field-definitions';
import { Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AppSettings, FieldConfig, ProcessedSettings } from '../models/settings'; 
import { Subscription } from 'rxjs';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { TranslateService } from '@ngx-translate/core';
import { SettingsService } from '../settings.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {

  settings: AppSettings = { availableFields: [], customHeader: '# PO Line Export' };
  form!: FormGroup;
  saving = false;

  expandedIndex: number | null = null;
  hoverIndex: number | null = null;

  private configSubscription: Subscription | undefined;

  get fieldsFormArray(): FormArray {
    return this.form.get('availableFields') as FormArray;
  }

  get selectedFieldsCount(): number {
    if (!this.form) return 0;
    return this.fieldsFormArray.controls.filter(control => control.value.selected).length;
  }

  get allFieldsSelected(): boolean {
    return this.fieldsFormArray.length > 0 && this.selectedFieldsCount === this.fieldsFormArray.length;
  }

  get someFieldsSelected(): boolean {
    return this.selectedFieldsCount > 0 && !this.allFieldsSelected;
  }
  
  constructor(
    private cloudSettingsService: CloudAppSettingsService, 
    private alert: AlertService,
    public router: Router,
    private translate: TranslateService,
    private settingsService: SettingsService 
  ) {
    this.form = new FormGroup({
      availableFields: new FormArray([]),
      customHeader: new FormControl('')
    });
  }

  ngOnInit() {
    this.configSubscription = this.settingsService.getSettings().subscribe({
      next: (processed: ProcessedSettings) => {
        this.settings = processed.settings;
        this.initForm();
      },
      error: (err: any) => this.alert.error(this.translate.instant('Settings.Alerts.LoadError') + err.message)
    });
  }

  ngOnDestroy(): void {
    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }
}

  initForm() {
    this.fieldsFormArray.clear();
    this.settings.availableFields.forEach(field => {
      this.fieldsFormArray.push(new FormGroup({
        name: new FormControl(field.name),
        label: new FormControl(field.label), 
        selected: new FormControl(field.selected),
        customLabel: new FormControl(this.translate.instant(field.customLabel))
      }));
    });
    this.form.patchValue({ customHeader: this.settings.customHeader });
  }

  toggleExpand(index: number) {
    this.expandedIndex = this.expandedIndex === index ? null : index;
  }

  drop(event: CdkDragDrop<FormGroup[]>) {
    moveItemInArray(this.fieldsFormArray.controls, event.previousIndex, event.currentIndex);
    this.fieldsFormArray.updateValueAndValidity();
    this.form.markAsDirty();
  }

  toggleSelectAll(event: MatCheckboxChange) {
    this.fieldsFormArray.controls.forEach(control => {
      control.get('selected')?.setValue(event.checked);
    });
    this.form.markAsDirty();
  }

  resetSettings() {
    this.alert.info(this.translate.instant('Settings.Alerts.ResetInfo'), { autoClose: true });
    const defaultSettings: AppSettings = {
      availableFields: JSON.parse(JSON.stringify(AVAILABLE_FIELDS)),
      customHeader: '# PO Line Export'
    };
    this.settings = defaultSettings;
    this.initForm();
    this.form.markAsDirty();
  }

  saveSettings() {
    if (this.saving) return;
    this.saving = true;

    this.cloudSettingsService.set(this.form.value).subscribe({
      next: () => {
        this.saving = false;
        this.alert.success(this.translate.instant('Settings.Alerts.SaveSuccess'));
       this.router.navigate(['/']);
      },
      error: (err: any) => {
        this.saving = false;
        this.alert.error(this.translate.instant('Settings.Alerts.SaveError') + err.message);
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/']);
  }
  
  private _translationKeyCollector() {
    this.translate.instant('Fields.ISBN');
    this.translate.instant('Fields.Title');
    this.translate.instant('Fields.Quantity');
    this.translate.instant('Fields.PONumber');
    this.translate.instant('Fields.Author');
    this.translate.instant('Fields.LineNumber');
    this.translate.instant('Fields.Owner');
    this.translate.instant('Fields.Vendor');
    this.translate.instant('Fields.Price');
    this.translate.instant('Fields.Fund');
    this.translate.instant('Fields.CreatedDate');
  }

}

