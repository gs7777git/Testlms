
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


export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ isOpen, onClose, onImportComplete }): JSX.Element | null => {
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
  const [importResult, setImportResult] = useState<{ successCount: number; errorCount: number; errorsDetails?: {row: number, leadName: string, error: string}[] } | null>(null);


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
    setImportResult(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type !== 'text/csv') {
        setUploadError("Invalid file type. Please upload a CSV file.");
        setCsvFile(null);
        return;
      }
      setCsvFile(file);
      setUploadError(null);
    }
  };

  const parseCSV = async () => {
    if (!csvFile) {
      setUploadError("Please select a file to upload.");
      return;
    }
    setIsLoading(true);
    setUploadError(null);
    try {
      const text = await csvFile.text();
      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        throw new Error("CSV file must contain at least one header row and one data row.");
      }
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => line.split(',').map(val => val.trim()));
      
      setCsvHeaders(headers);
      setCsvData(data);
      
      // Attempt auto-mapping
      const initialMapping: Mapping = {};
      headers.forEach(header => {
        const matchedField = STANDARD_LEAD_FIELDS.find(field => field.toLowerCase() === header.toLowerCase());
        initialMapping[header] = matchedField || ''; 
      });
      setColumnMapping(initialMapping);
      setStep('mapping');

    } catch (error: any) {
      setUploadError(error.message || "Failed to parse CSV file.");
      console.error("CSV Parsing error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingChange = (csvHeader: string, crmField: Extract<keyof ImportedLeadData, string> | 'ignore' | '') => {
    setColumnMapping(prev => ({ ...prev, [csvHeader]: crmField }));
  };

  const validateAndPreview = () => {
    // Validate required fields are mapped
    const mappedCrmFields = Object.values(columnMapping);
    const missingRequired = REQUIRED_CRM_FIELDS.filter(rf => !mappedCrmFields.includes(rf));
    if (missingRequired.length > 0) {
      setUploadError(`The following CRM fields are required and must be mapped: ${missingRequired.join(', ')}.`);
      return;
    }
    
    setIsLoading(true);
    const leads: ImportedLeadData[] = [];
    const errors: { row: string[], error: string }[] = [];

    csvData.forEach((row, rowIndex) => {
      const lead: ImportedLeadData = {};
      let rowError = '';

      csvHeaders.forEach((header, colIndex) => {
        const crmFieldKey = columnMapping[header];
        if (crmFieldKey && crmFieldKey !== 'ignore' && crmFieldKey !== '') {
          let value: string | LeadStatus | undefined = row[colIndex];
          
          if (crmFieldKey === 'status' && value && !LEAD_STATUS_OPTIONS.includes(value as LeadStatus)) {
            rowError += `Invalid status "${value}" for row ${rowIndex + 1}. Defaulting to 'New'. `;
            value = LeadStatus.NEW;
          }
          if (crmFieldKey === 'email' && value && !/\S+@\S+\.\S+/.test(value)) {
             rowError += `Invalid email format "${value}" for row ${rowIndex + 1}. `;
          }
          lead[crmFieldKey] = value as any; // Type assertion here, ensure validation handles types
        }
      });

      // Validate required CRM fields have data
      REQUIRED_CRM_FIELDS.forEach(rf => {
        if (!lead[rf] || String(lead[rf]).trim() === '') {
          rowError += `Missing required value for ${rf} in row ${rowIndex + 1}. `;
        }
      });

      if (rowError) {
        errors.push({ row, error: rowError.trim() });
      } else {
        leads.push(lead);
      }
    });
    
    setParsedLeads(leads);
    setErrorRows(errors);
    setStep('review');
    setIsLoading(false);
    setUploadError(null); 
  };

  const handleConfirmImport = async () => {
    if (!currentUserProfile?.org_id || parsedLeads.length === 0) {
      setUploadError("No valid leads to import or organization context is missing.");
      return;
    }
    setIsLoading(true);
    setUploadError(null);
    try {
      const result = await leadService.bulkAddLeads(parsedLeads, currentUserProfile.org_id);
      setImportResult(result);
      setStep('result');
    } catch (error: any) {
      setUploadError(error.message || "An error occurred during the import process.");
    } finally {
      setIsLoading(false);
    }
  };


  const crmFieldOptions = [
    { value: '', label: 'Select CRM Field' },
    { value: 'ignore', label: 'Ignore this column' },
    ...STANDARD_LEAD_FIELDS.map(field => ({ value: field, label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }))
  ];

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Import Leads from CSV" size="xl">
      {isLoading && <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-50"><Spinner /></div>}
      
      {uploadError && <div className="p-3 bg-red-100 text-red-700 rounded-md mb-4" role="alert">{uploadError}</div>}

      {step === 'upload' && (
        <div className="space-y-4">
          <p className="text-sm text-secondary-600">
            Upload a CSV file with your lead data. Ensure the first row contains headers.
            Required fields are: <span className="font-semibold">{REQUIRED_CRM_FIELDS.join(', ')}</span>.
            Optional standard fields include: <span className="font-semibold">{STANDARD_LEAD_FIELDS.filter(f => !REQUIRED_CRM_FIELDS.includes(f)).join(', ')}</span>.
          </p>
          <Input type="file" id="csv-bulk-upload" accept=".csv" onChange={handleFileChange} label="CSV File" wrapperClassName="w-full" />
          <Button onClick={parseCSV} disabled={!csvFile || isLoading} leftIcon={<UploadIcon className="h-5 w-5" />}>Parse CSV & Map Columns</Button>
        </div>
      )}

      {step === 'mapping' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Map CSV Columns to CRM Fields</h3>
          <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
            {csvHeaders.map(header => (
              <div key={header} className="grid grid-cols-2 gap-4 items-center p-2 border rounded-md">
                <span className="font-medium text-secondary-700 truncate" title={header}>{header}</span>
                <Select 
                  id={`map-${header}`}
                  value={columnMapping[header] || ''} 
                  onChange={(e) => handleMappingChange(header, e.target.value as Extract<keyof ImportedLeadData, string> | 'ignore' | '')}
                  options={crmFieldOptions}
                  aria-label={`Map CSV header ${header}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep('upload')}>Back to Upload</Button>
            <Button onClick={validateAndPreview} disabled={isLoading}>Review Data</Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Review Import Data ({parsedLeads.length} valid leads, {errorRows.length} rows with errors)</h3>
            {parsedLeads.length > 0 && (
                <div className="max-h-60 overflow-y-auto border rounded-md p-2 mb-4">
                    <h4 className="font-semibold text-green-700 mb-1">Valid Leads for Import:</h4>
                    <ul className="list-disc list-inside text-sm">
                        {parsedLeads.slice(0, 5).map((lead, i) => <li key={i} className="truncate" title={JSON.stringify(lead)}>{lead.name} ({lead.email})</li>)}
                        {parsedLeads.length > 5 && <li>And {parsedLeads.length - 5} more...</li>}
                    </ul>
                </div>
            )}
            {errorRows.length > 0 && (
                <div className="max-h-60 overflow-y-auto border border-red-300 bg-red-50 rounded-md p-2">
                    <h4 className="font-semibold text-red-700 mb-1">Rows with Errors (will be skipped):</h4>
                     <ul className="list-disc list-inside text-sm">
                        {errorRows.slice(0,5).map((errRow, i) => <li key={`err-${i}`} className="text-red-600 truncate" title={errRow.error}>Row: {errRow.row.join(', ')} - Error: {errRow.error.substring(0, 100)}...</li>)}
                        {errorRows.length > 5 && <li>And {errorRows.length - 5} more rows with errors...</li>}
                    </ul>
                </div>
            )}
            <p className="text-sm text-secondary-600">
                Proceeding will import {parsedLeads.length} leads. Rows with errors will be skipped.
            </p>
            <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('mapping')}>Back to Mapping</Button>
                <Button onClick={handleConfirmImport} disabled={isLoading || parsedLeads.length === 0} leftIcon={<CheckCircleIcon className="h-5 w-5"/>}>Confirm & Import Leads</Button>
            </div>
        </div>
      )}

      {step === 'result' && importResult && (
         <div className="space-y-4 text-center">
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-xl font-semibold text-green-700">Import Complete!</h3>
            <p>Successfully imported: <span className="font-bold">{importResult.successCount}</span> leads.</p>
            {importResult.errorCount > 0 && (
                <p className="text-red-600">Skipped due to errors: <span className="font-bold">{importResult.errorCount}</span> leads.</p>
            )}
            {importResult.errorsDetails && importResult.errorsDetails.length > 0 && (
                <div className="mt-2 text-xs text-left bg-secondary-50 p-2 rounded max-h-40 overflow-y-auto">
                    <p className="font-semibold">Error Details (first few):</p>
                    <ul>{importResult.errorsDetails.slice(0,5).map(err => <li key={err.row}>Row {err.row} ({err.leadName}): {err.error}</li>)}</ul>
                </div>
            )}
            <Button onClick={() => { onImportComplete(); onClose(); }} className="mt-4">Close</Button>
         </div>
      )}
       {step === 'result' && !importResult && uploadError && ( // If import failed entirely at API level
         <div className="space-y-4 text-center">
            <ExclamationCircleIcon className="h-16 w-16 text-red-500 mx-auto" />
            <h3 className="text-xl font-semibold text-red-700">Import Failed</h3>
            <p>{uploadError}</p>
            <Button onClick={onClose} className="mt-4">Close</Button>
         </div>
      )}
    </Modal>
  );
};
