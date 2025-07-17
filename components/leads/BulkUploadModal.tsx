
import React, { useState, ChangeEvent, useCallback, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Spinner } from '@/components/common/Spinner';
import { UploadIcon, CheckCircleIcon, ExclamationCircleIcon } from '@/components/common/Icons';
import { leadService } from '@/services/api';
import { LeadStatus, ImportedLeadData } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { LEAD_STATUS_OPTIONS } from '@/constants';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void; 
}

type Mapping = { [csvHeader: string]: Extract<keyof ImportedLeadData, string> | 'ignore' | '' };
type ImportStep = 'upload' | 'mapping' | 'review' | 'result';

const STANDARD_LEAD_FIELDS: (Extract<keyof ImportedLeadData, string>)[] = [
  'name', 'email', 'mobile', 'source', 'status', 'stage', 'notes', 'company_name', 'contact_name'
];
const REQUIRED_CRM_FIELDS: (Extract<keyof ImportedLeadData, string>)[] = ['name', 'email'];


export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const { profile: currentUserProfile } = useAuth();
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]); 
  const [columnMapping, setColumnMapping] = useState<Mapping>({});
  const [parsedLeads, setParsedLeads] = useState<ImportedLeadData[]>([]);
  const [errorRows, setErrorRows] = useState<{ row: string[], error: string }[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{successCount: number, errorCount: number, errorsDetails?: any[]}>({successCount: 0, errorCount: 0});

  const resetState = useCallback(() => {
    setStep('upload');
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping({});
    setParsedLeads([]);
    setErrorRows([]);
    setIsLoading(false);
    setUploadError(null);
    setImportResult({successCount: 0, errorCount: 0});
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);


  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setUploadError(null);
    }
  };

  const handleProcessFile = async () => {
    if (!csvFile) {
      setUploadError("Please select a file.");
      return;
    }
    setIsLoading(true);
    try {
      const text = await csvFile.text();
      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        throw new Error("CSV file must have a header row and at least one data row.");
      }
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => line.split(',').map(v => v.trim()));
      
      setCsvHeaders(headers);
      setCsvData(data);
      
      const initialMapping: Mapping = {};
      headers.forEach(header => {
        const matchingField = STANDARD_LEAD_FIELDS.find(field => field.replace(/_/g, ' ').toLowerCase() === header.toLowerCase().replace(/_/g, ' '));
        initialMapping[header] = matchingField || '';
      });
      setColumnMapping(initialMapping);

      setStep('mapping');
    } catch (err: any) {
      setUploadError(err.message || "Failed to process file.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMappingChange = (csvHeader: string, crmField: string) => {
    setColumnMapping(prev => ({ ...prev, [csvHeader]: crmField as any }));
  };

  const goToReviewStep = () => {
    const mappedFields = Object.values(columnMapping);
    const missingRequired = REQUIRED_CRM_FIELDS.some(field => !mappedFields.includes(field));
    if (missingRequired) {
        setUploadError(`You must map columns to the following required fields: ${REQUIRED_CRM_FIELDS.join(', ')}.`);
        return;
    }
    setUploadError(null);
    
    const leads: ImportedLeadData[] = [];
    const errors: { row: string[], error: string }[] = [];

    csvData.forEach((row, rowIndex) => {
        const lead: ImportedLeadData = {};
        let isValid = true;
        let rowError = '';

        csvHeaders.forEach((header, colIndex) => {
            const crmField = columnMapping[header];
            if (crmField && crmField !== 'ignore' && crmField !== '') {
                lead[crmField] = row[colIndex];
            }
        });

        REQUIRED_CRM_FIELDS.forEach(field => {
            if (!lead[field] || String(lead[field]).trim() === '') {
                isValid = false;
                rowError += `Missing required field '${field}'. `;
            }
        });
        
        if (lead.email && !/\S+@\S+\.\S+/.test(String(lead.email))) {
            isValid = false;
            rowError += `Invalid email format. `;
        }
        if (lead.status && !LEAD_STATUS_OPTIONS.includes(lead.status as LeadStatus)) {
            isValid = false;
            rowError += `Invalid status value. Must be one of: ${LEAD_STATUS_OPTIONS.join(', ')}. `;
        }


        if (isValid) {
            leads.push(lead);
        } else {
            errors.push({ row, error: rowError.trim() });
        }
    });

    setParsedLeads(leads);
    setErrorRows(errors);
    setStep('review');
  };

  const handleConfirmImport = async () => {
    if (!currentUserProfile?.org_id || parsedLeads.length === 0) return;
    setIsLoading(true);
    try {
        const result = await leadService.bulkAddLeads(parsedLeads, currentUserProfile.org_id);
        setImportResult(result);
        setStep('result');
    } catch (err: any) {
        setUploadError(err.message || "An unexpected error occurred during import.");
    } finally {
        setIsLoading(false);
    }
  };

  const mappingOptions = [
    { value: '', label: '-- Select Field --' },
    { value: 'ignore', label: 'Ignore this column' },
    ...STANDARD_LEAD_FIELDS.map(field => ({
      value: field,
      label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    }))
  ];

  const renderContent = () => {
    switch(step) {
      case 'upload':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-secondary-800">Step 1: Upload CSV File</h3>
            <p className="text-sm text-secondary-600">Select a CSV file containing your leads. The first row should be the header. Required columns are 'name' and 'email'.</p>
            <Input type="file" id="csv-upload" accept=".csv" onChange={handleFileChange} />
            {uploadError && <p className="text-sm text-red-600" role="alert">{uploadError}</p>}
            <div className="flex justify-end pt-4">
                <Button onClick={handleProcessFile} leftIcon={<UploadIcon className="h-5 w-5"/>} disabled={!csvFile || isLoading} isLoading={isLoading}>
                    Process File & Map Columns
                </Button>
            </div>
          </div>
        );
      case 'mapping':
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-secondary-800">Step 2: Map Columns</h3>
                <p className="text-sm text-secondary-600">Match the columns from your CSV file to the CRM lead fields. Required fields are marked with *.</p>
                <div className="max-h-80 overflow-y-auto space-y-3 p-2 border rounded-md">
                {csvHeaders.map(header => (
                    <div key={header} className="grid grid-cols-2 gap-4 items-center">
                        <span className="font-semibold text-secondary-700 truncate" title={header}>{header}</span>
                        <Select
                            id={`map-${header}`}
                            value={columnMapping[header] || ''}
                            onChange={(e) => handleMappingChange(header, e.target.value)}
                            options={mappingOptions}
                            required={REQUIRED_CRM_FIELDS.includes(columnMapping[header] as any)}
                        />
                    </div>
                ))}
                </div>
                 {uploadError && <p className="text-sm text-red-600 mt-2" role="alert">{uploadError}</p>}
                <div className="flex justify-between items-center pt-4">
                    <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                    <Button onClick={goToReviewStep}>Review & Validate Data</Button>
                </div>
            </div>
        );
       case 'review':
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-secondary-800">Step 3: Review and Confirm</h3>
                {parsedLeads.length > 0 && (
                     <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                         <p className="text-sm font-semibold text-green-800">{parsedLeads.length} lead(s) are valid and ready for import.</p>
                     </div>
                )}
                {errorRows.length > 0 && (
                     <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                         <p className="text-sm font-semibold text-red-800">{errorRows.length} row(s) have errors and will be skipped.</p>
                          <ul className="text-xs text-red-700 list-disc list-inside mt-1 max-h-40 overflow-y-auto">
                            {errorRows.slice(0, 5).map((e, i) => <li key={i}>{e.error} (Row: "{e.row.join(',').substring(0, 50)}...")</li>)}
                            {errorRows.length > 5 && <li>...and {errorRows.length - 5} more.</li>}
                        </ul>
                     </div>
                )}
                <div className="flex justify-between items-center pt-4">
                    <Button variant="outline" onClick={() => setStep('mapping')}>Back to Mapping</Button>
                    <Button onClick={handleConfirmImport} disabled={parsedLeads.length === 0 || isLoading} isLoading={isLoading}>
                        Confirm and Import {parsedLeads.length} Leads
                    </Button>
                </div>
            </div>
        );
        case 'result':
        return (
            <div className="text-center space-y-4 py-8">
                {importResult.errorCount === 0 ? (
                    <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto"/>
                ) : (
                    <ExclamationCircleIcon className="h-16 w-16 text-yellow-500 mx-auto"/>
                )}
                <h3 className="text-2xl font-bold text-secondary-800">Import Complete</h3>
                 <p className="text-green-700">{importResult.successCount} leads imported successfully.</p>
                 {importResult.errorCount > 0 && <p className="text-red-700">{importResult.errorCount} leads failed to import.</p>}
                 {uploadError && <p className="text-red-700">{uploadError}</p>}
                <Button onClick={onImportComplete} size="lg">Done</Button>
            </div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Import Leads from CSV" size="xl">
      {renderContent()}
    </Modal>
  );
};
