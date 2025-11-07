import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
    CloudAppRestService,
    Entity,
    HttpMethod,
    AlertService,
} from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FieldConfig } from './models/settings';

export interface ExportResult {
    fileContent: string;
    exportFields: FieldConfig[];
    count: number;
}

@Injectable({
    providedIn: 'root'
})
export class ExportService {

    constructor(
        private restService: CloudAppRestService,
        private http: HttpClient,
        private alert: AlertService,
        private translate: TranslateService
    ) { }

    generateExport(
        selectedEntities: Entity[],
        exportFields: FieldConfig[], 
        customHeader: string
    ): Observable<ExportResult> {
        
        const requests = selectedEntities.map(entity =>
            this.restService.call({ url: entity.link, method: HttpMethod.GET })
        );

        return forkJoin(requests).pipe(
            map(responses => {
                const fileContent = this._generateFileContent(responses, exportFields, customHeader);

                return {
                    fileContent: fileContent,
                    exportFields: exportFields,
                    count: selectedEntities.length
                } as ExportResult;
            })
        );
    }
    
    
    copyContent(content: string): Promise<void> {
        if (!content) {
            this.alert.warn(this.translate.instant('Main.Alerts.NoPreviewContent'));
            return Promise.reject(new Error('No content to copy.'));
        }

        console.log('Using legacy copy method (execCommand) for Alma compatibility.');
        
        return this.copyContentLegacy(content);
    }

    private copyContentLegacy(content: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = 'fixed'; 
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if(successful) {
                this.alert.success(this.translate.instant('Main.Alerts.CopySuccess'));
                resolve();
            } else {
                this.alert.error(this.translate.instant('Main.Alerts.CopyError'));
                reject(new Error('execCommand failed.'));
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            this.alert.error(this.translate.instant('Main.Alerts.CopyError'));
            reject(err);
        }
        document.body.removeChild(textArea);
      });
    }

    downloadContent(content: string) {
        if (!content) {
            this.alert.warn(this.translate.instant('Main.Alerts.NoPreviewContent'));
            return;
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.translate.instant('Main.ExportFilename'); 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.alert.success(this.translate.instant('Main.Alerts.DownloadSuccess'));
    }

    private _generateFileContent(responses: any[], exportFields: FieldConfig[], customHeader: string): string {
        const headers = exportFields.map((field: FieldConfig) => {
            if (typeof field.customLabel === 'string' && field.customLabel.startsWith('Fields.')) {
                try {
                   return this.translate.instant(field.customLabel); 
                } catch (e) {
                   console.error(`Missing translation for key: ${field.customLabel}`);
                   return field.customLabel; 
                }
            }
            return field.customLabel || ''; 
       }).join('\t');

        const headerLine = customHeader ? `${customHeader}\n` : ''; 
        let fileContent = `${headerLine}${headers}\n`; 

        responses.forEach((poLine: any) => {
            const row = exportFields.map((field: FieldConfig) => {
                 switch (field.name) {
                    case 'isbn': return poLine.resource_metadata?.isbn || '';
                    case 'title': return poLine.resource_metadata?.title || '';
                    case 'author': return poLine.resource_metadata?.author || '';
                    case 'poNumber': return poLine.po_number || '';
                    case 'line_number': return poLine.number || '';
                    case 'owner': return poLine.owner?.desc || '';
                    case 'vendor': return poLine.vendor?.desc || '';
                    case 'price': return (poLine.price?.sum || poLine.price?.amount || '0').toString();
                    case 'fund': {
                        const fundCodes = (poLine.fund_distribution || [])

                            .map((fund: any) => fund.fund_code?.value)
                            .filter((value: string | undefined) => value) 
                            .join('; '); 
                        return fundCodes || '';
                    }
                    case 'quantity': return (poLine.location || []).reduce((sum: number, loc: any) => sum + (loc.quantity || 0), 0);
                    case 'created_date': return poLine.created_date || '';
                    default: return '';
                }
            }).join('\t');
            fileContent += `${row}\n`;
        });
        return fileContent;
    }
}