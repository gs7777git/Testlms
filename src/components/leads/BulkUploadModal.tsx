
import React, { useState, ChangeEvent, useCallback, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Spinner } from '@/components/common/Spinner';
import { UploadIcon, CheckCircleIcon, ExclamationCircleIcon } from '@/components/common/Icons';
import { leadService } from '@/services/api';
import { Lead, LeadStatus, ImportedLeadData } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { LEAD_STATUS_OPTIONS } from '@/constants';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void; // To refresh leads list on parent page
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
  const [csvData, setCsvData] = useState<string[][]>([]); // Store raw string data for preview
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
      setCsvFile(event.target.files[0]);
      setUploadError(null);
    }
  };

  const parseCsvHeaders = async () => {
    if (!csvFile) return;
    setIsLoading(true);
    setUploadError(null);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r\n|\n/);
        if (lines.length === 0) {
          setUploadError("CSV file is empty.");
          setIsLoading(false);
          return;
        }
        const headers = lines[0].split(',').map(h => h.trim());
        if (headers.length === 0 || headers.every(h => h === '')) {
            setUploadError("CSV file headers are missing or invalid.");
            setIsLoading(false);
            return;
        }
        setCsvHeaders(headers);

        const initialMapping: Mapping = {};
        headers.forEach(header => {
          const lowerHeader = (header as string).toLowerCase().replace(/[\s_]/g, ''); // Normalize header
          const matchedField = STANDARD_LEAD_FIELDS.find(field => lowerHeader.includes(field.toLowerCase()));
          initialMapping[header] = matchedField || ''; 
        });
        setColumnMapping(initialMapping);
        
        const dataRows = lines.slice(1).filter(line => line.trim() !== '').map(line => line.split(',').map(val => val.trim()));
        setCsvData(dataRows);

        setStep('mapping');
        setIsLoading(false);
      };
      reader.onerror = () => {
        setUploadError("Error reading file.");
        setIsLoading(false);
      };
      reader.readAsText(csvFile);
    } catch (err: any) {
      setUploadError(err.message || "Failed to parse CSV headers.");
      setIsLoading(false);
    }
  };

  const handleMappingChange = (csvHeader: string, crmField: string) => {
    setColumnMapping(prev => ({ ...prev, [csvHeader]: crmField as Extract<keyof ImportedLeadData, string> | 'ignore' | '' }));
  };

  const processMappedData = () => {
    setIsLoading(true);
    setUploadError(null);
    const tempParsedLeads: ImportedLeadData[] = [];
    const tempErrorRows: { row: string[], error: string }[] = [];

    // Validation for required CRM fields
    const mappedCrmFields = Object.values(columnMapping);
    const missingRequiredMappings = REQUIRED_CRM_FIELDS.filter(
      (requiredField) => !mappedCrmFields.includes(requiredField)
    );

    if (missingRequiredMappings.length > 0) {
      setUploadError(
        `Required CRM fields not mapped: ${missingRequiredMappings.join(', ')}. Please map these fields to proceed.`
      );
      setIsLoading(false);
      return;
    }


    csvData.forEach((rowArray, rowIndex) => {
      const lead: ImportedLeadData = {};
      let rowError = '';

      csvHeaders.forEach((header, colIndex) => {
        const crmFieldKey = columnMapping[header];
        if (crmFieldKey && crmFieldKey !== 'ignore' && crmFieldKey !== '') {
          lead[crmFieldKey as Extract<keyof ImportedLeadData, string>] = rowArray[colIndex] || '';
        }
      });
      
      // Basic Validation
      if (!lead.name?.trim()) rowError += 'Lead Name is missing. ';
      if (!lead.email?.trim()) rowError += 'Email is missing. ';
      else if (!/\S+@\S+\.\S+/.test(lead.email)) rowError += 'Invalid Email format. ';
      
      if(lead.status && !LEAD_STATUS_OPTIONS.includes(lead.status as LeadStatus)) {
        rowError += `Invalid Status: '${lead.status}'. Valid statuses: ${LEAD_STATUS_OPTIONS.join(', ')}. Will default to 'New'. `;
        lead.status = LeadStatus.NEW; // Correct invalid status to default
      } else if (!lead.status) {
        lead.status = LeadStatus.NEW; // Default status if not provided
      }

      if (rowError.includes('missing') || rowError.includes('Invalid Email format')) { // Only critical errors prevent processing
        tempErrorRows.push({ row: rowArray, error: rowError.trim() });
      } else {
        if(rowError) console.warn(`Row ${rowIndex+1} (Lead: ${lead.name || 'Unknown'}) has correctable warnings: ${rowError.trim()}`);
        tempParsedLeads.push(lead);
      }
    });

    setParsedLeads(tempParsedLeads);
    setErrorRows(tempErrorRows);
    setStep('review');
    setIsLoading(false);
  };

  const handleImportLeads = async () => {
    if (!currentUserProfile?.org_id) {
        setUploadError("Organization context is missing.");
        return;
    }
    if (parsedLeads.length === 0) {
        setUploadError("No valid leads to import.");
        return;
    }
    setIsLoading(true);
    setUploadError(null);
    try {
      const result = await leadService.bulkAddLeads(parsedLeads, currentUserProfile.org_id);
      setImportResult(result);
      setStep('result');
      onImportComplete(); 
    } catch (err: any) {
      setUploadError(err.message || "Import failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const downloadErrorCsv = () => {
    if (!importResult?.errorsDetails || importResult.errorsDetails.length === 0) return;
    const csvContent = "RowNumber,LeadName,Error\n" + 
                       importResult.errorsDetails.map(e => `${e.row},"${(e.leadName as string).replace(/"/g, '""')}","${e.error.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "import_error_report.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };


  const crmFieldOptions: { value: string; label: string }[] = [
    { value: '', label: 'Select CRM Field' },
    { value: 'ignore', label: 'Ignore this column' },
    ...STANDARD_LEAD_FIELDS.map(field => ({ value: field, label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }))
  ];
  
  const unmappedCsvColumns = csvHeaders.filter(header => !columnMapping[header] || columnMapping[header] === '' || columnMapping[header] === 'ignore');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload Leads (CSV)" size="xl">
      {isLoading && <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-50"><Spinner size="lg" /></div>}
      
      {step === 'upload' && (
        <div className="space-y-4">
          <Input type="file" id="csv-bulk-upload" accept=".csv" onChange={handleFileChange} label="Select CSV File" wrapperClassName="w-full" />
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          <div className="flex justify-end">
            <Button onClick={parseCsvHeaders} disabled={!csvFile || isLoading} leftIcon={<UploadIcon className="h-5 w-5" />}>
              Parse & Map Columns
            </Button>
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-secondary-700">Map CSV Columns to CRM Fields</h3>
          <p className="text-sm text-secondary-600">
            Map each column from your CSV file to the corresponding field in the CRM. 
            Required CRM fields are <span className="font-semibold">{REQUIRED_CRM_FIELDS.join(', ')}</span>. Unmapped columns or columns set to 'Ignore' will not be imported.
            If a status is not provided or invalid, it will default to '{LeadStatus.NEW}'.
          </p>
          {uploadError && <p className="text-sm text-red-600 py-2">{uploadError}</p>}
          <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
            {csvHeaders.map(header => (
              <div key={header} className="grid grid-cols-2 gap-4 items-center p-2 border-b border-secondary-100">
                <span className="font-medium text-secondary-800 truncate" title={header}>{header}</span>
                <Select
                  value={columnMapping[header] as string || ''}
                  onChange={(e) => handleMappingChange(header, e.target.value)}
                  options={crmFieldOptions}
                  aria-label={`Map CSV column ${header}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-6">
            <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
            <Button onClick={processMappedData} disabled={isLoading}>Review Data</Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-secondary-700">Review Import Data</h3>
          <div className="flex flex-col sm:flex-row sm:justify-around gap-4 text-center">
            <div className="p-3 bg-green-50 rounded-md">
                <CheckCircleIcon className="h-8 w-8 text-green-500 mx-auto mb-1"/>
                <p className="text-2xl font-bold text-green-700">{parsedLeads.length}</p>
                <p className="text-sm text-green-600">Leads to be Imported</p>
            </div>
            <div className="p-3 bg-red-50 rounded-md">
                <ExclamationCircleIcon className="h-8 w-8 text-red-500 mx-auto mb-1"/>
                <p className="text-2xl font-bold text-red-700">{errorRows.length}</p>
                <p className="text-sm text-red-600">Rows with Critical Errors (will be skipped)</p>
            </div>
          </div>
          {unmappedCsvColumns.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
              <p className="font-semibold text-yellow-700">The following CSV columns are not mapped (or set to 'Ignore') and their data will not be imported:</p>
              <ul className="list-disc list-inside ml-4 text-yellow-600">
                {unmappedCsvColumns.map(col => <li key={col}>{col}</li>)}
              </ul>
              <p className="mt-1 text-xs text-yellow-500">To include this data, ensure your CSV column names match expected CRM fields or look forward to future custom field support.</p>
            </div>
          )}
          {errorRows.length > 0 && (
            <div className="mt-2">
              <h4 className="text-md font-semibold text-red-700">Preview of Errored Rows (First 5):</h4>
              <ul className="text-xs text-red-600 list-disc list-inside max-h-32 overflow-y-auto">
                {errorRows.slice(0, 5).map((errRow, i) => <li key={i}>{errRow.row.join(", ")} - <span className="font-medium">{errRow.error}</span></li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-between items-center mt-6">
            <Button variant="outline" onClick={() => setStep('mapping')}>Back to Mapping</Button>
            <Button onClick={handleImportLeads} disabled={isLoading || parsedLeads.length === 0}>
              Import {parsedLeads.length} Leads
            </Button>
          </div>
        </div>
      )}

      {step === 'result' && importResult && (
        <div className="text-center space-y-4 py-8">
          <CheckCircleIcon className={`h-16 w-16 mx-auto ${importResult.successCount > 0 ? 'text-green-500' : 'text-secondary-400'}`} />
          <h3 className="text-xl font-semibold text-secondary-800">Import Complete</h3>
          <p className="text-secondary-700">
            Successfully imported <span className="font-bold text-green-600">{importResult.successCount}</span> leads.
          </p>
          {importResult.errorCount > 0 && (
            <p className="text-secondary-700">
              Failed to import <span className="font-bold text-red-600">{importResult.errorCount}</span> leads due to critical errors.
            </p>
          )}
          {importResult.errorsDetails && importResult.errorsDetails.length > 0 && (
             <Button variant="outline" onClick={downloadErrorCsv} size="sm">Download Error Report (CSV)</Button>
          )}
          <div className="pt-4">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
