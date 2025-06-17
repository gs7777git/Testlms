
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { PlusIcon, EditIcon, DeleteIcon } from '@/components/common/Icons';
import { companyService } from '@/services/api';
import { Company, Role } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyToEdit: Company | null;
  onSave: (company: Omit<Company, 'id' | 'created_at' | 'updated_at' | 'org_id'> | Company) => Promise<void>;
}

const CompanyModal: React.FC<CompanyModalProps> = ({ isOpen, onClose, companyToEdit, onSave }) => {
  const initialCompanyState: Omit<Company, 'id' | 'created_at' | 'updated_at' | 'org_id'> = {
    name: '', industry: '', website: '', phone_office: '',
    address_street: '', address_city: '', address_state: '', address_postal_code: '', address_country: ''
  };
  const [companyData, setCompanyData] = useState(initialCompanyState);
  const [isLoadingModal, setIsLoadingModal] = useState(false); 
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (companyToEdit) {
      setCompanyData({
        name: companyToEdit.name,
        industry: companyToEdit.industry || '',
        website: companyToEdit.website || '',
        phone_office: companyToEdit.phone_office || '',
        address_street: companyToEdit.address_street || '',
        address_city: companyToEdit.address_city || '',
        address_state: companyToEdit.address_state || '',
        address_postal_code: companyToEdit.address_postal_code || '',
        address_country: companyToEdit.address_country || '',
      });
    } else {
      setCompanyData(initialCompanyState);
    }
    setErrors({});
  }, [companyToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompanyData(prev => ({ ...prev, [name]: value }));
     if (errors[name]) setErrors(prev => ({...prev, [name]: ''}));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!companyData.name.trim()) newErrors.name = "Company name is required.";
    if (companyData.website && !/^https?:\/\/[^\s$.?#].[^\s]*$/.test(companyData.website)) {
        newErrors.website = "Please enter a valid URL (e.g., http://example.com).";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoadingModal(true);
    try {
      const finalData: any = { ...companyData };
      if (companyToEdit?.id) finalData.id = companyToEdit.id;
      await onSave(finalData);
      onClose();
    } catch (error: any) {
      setErrors({ form: error.message || "Failed to save company." });
    } finally {
      setIsLoadingModal(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={companyToEdit ? "Edit Company" : "Add New Company"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Company Name" id="name" name="name" value={companyData.name} onChange={handleChange} error={errors.name} required disabled={isLoadingModal} />
        <Input label="Industry" id="industry" name="industry" value={companyData.industry || ''} onChange={handleChange} disabled={isLoadingModal} />
        <Input label="Website" id="website" name="website" type="url" value={companyData.website || ''} onChange={handleChange} error={errors.website} disabled={isLoadingModal} />
        <Input label="Office Phone" id="phone_office" name="phone_office" type="tel" value={companyData.phone_office || ''} onChange={handleChange} disabled={isLoadingModal} />
        
        <h3 className="text-md font-semibold text-secondary-600 pt-2">Address</h3>
        <Input label="Street" id="address_street" name="address_street" value={companyData.address_street || ''} onChange={handleChange} disabled={isLoadingModal} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="City" id="address_city" name="address_city" value={companyData.address_city || ''} onChange={handleChange} disabled={isLoadingModal} />
            <Input label="State/Province" id="address_state" name="address_state" value={companyData.address_state || ''} onChange={handleChange} disabled={isLoadingModal} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Postal Code" id="address_postal_code" name="address_postal_code" value={companyData.address_postal_code || ''} onChange={handleChange} disabled={isLoadingModal} />
            <Input label="Country" id="address_country" name="address_country" value={companyData.address_country || ''} onChange={handleChange} disabled={isLoadingModal} />
        </div>

        {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoadingModal}>Cancel</Button>
          <Button type="submit" isLoading={isLoadingModal} disabled={isLoadingModal}>{companyToEdit ? "Save Changes" : "Add Company"}</Button>
        </div>
      </form>
    </Modal>
  );
};


export const CompaniesPage: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { profile: currentUserProfile, hasRole } = useAuth();

  const fetchData = useCallback(async (options?: {isInitialLoad?: boolean}) => {
    const {isInitialLoad = false} = options || {};
    if (!currentUserProfile?.org_id) {
        if(isInitialLoad) setPageLoading(false);
        setIsDataLoading(false);
        setCompanies([]);
        return;
    }

    if (isInitialLoad) {
        setPageLoading(true);
    } else {
        setIsDataLoading(true);
    }

    try {
      const fetchedCompanies = await companyService.getCompanies(currentUserProfile.org_id);
      setCompanies(fetchedCompanies);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
      alert(`Error fetching companies: ${(error as Error).message}`);
      setCompanies([]);
    } finally {
      if(isInitialLoad) {
        setPageLoading(false);
      }
      setIsDataLoading(false);
    }
  }, [currentUserProfile?.org_id]);

  useEffect(() => {
    if (currentUserProfile?.org_id) {
        fetchData({isInitialLoad: true});
    } else {
        setPageLoading(false);
        setIsDataLoading(false);
        setCompanies([]);
    }
  }, [currentUserProfile?.org_id, fetchData]);

  const refreshCompaniesData = () => {
    fetchData({ isInitialLoad: false });
  };

  const handleOpenModal = (company: Company | null = null) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCompany(null);
  };

  const handleSaveCompany = async (companyData: Omit<Company, 'id' | 'created_at' | 'updated_at' | 'org_id'> | Company) => {
    if (!currentUserProfile?.org_id) throw new Error("Organization ID is missing.");
    setIsDataLoading(true);
    try {
        if ('id' in companyData && companyData.id) {
        const { id, org_id, created_at, updated_at, ...dataToUpdate } = companyData as Company;
        await companyService.updateCompany(id, dataToUpdate);
        } else {
        await companyService.addCompany(companyData as Omit<Company, 'id'|'created_at'|'updated_at'|'org_id'>, currentUserProfile.org_id);
        }
        refreshCompaniesData();
    } catch (error) {
        console.error("Error saving company:", error);
        setIsDataLoading(false);
        throw error; 
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (window.confirm("Are you sure you want to delete this company? This will also unlink it from associated contacts, leads, and deals.")) {
      setIsDataLoading(true);
      try {
        await companyService.deleteCompany(companyId);
        refreshCompaniesData();
      } catch (error) {
        console.error("Failed to delete company:", error);
        alert(`Error deleting company: ${(error as Error).message}`);
      } finally {
        setIsDataLoading(false);
      }
    }
  };
  
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.industry && company.industry.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (company.website && company.website.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (pageLoading) {
      return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-secondary-900">Company Management</h1>
        <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={isDataLoading}>
          Add New Company
        </Button>
      </div>
      <div className="mb-4">
        <Input
          placeholder="Search companies by name, industry, website..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search companies"
        />
      </div>
      
      <div className="bg-white shadow overflow-x-auto rounded-lg">
        <table className="min-w-full divide-y divide-secondary-200" aria-label="Companies Table">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Industry</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Website</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Phone</th>
               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Last Updated</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {isDataLoading && companies.length > 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center relative">
                 <div className="absolute inset-0 bg-white bg-opacity-50 flex justify-center items-center"><Spinner /></div>
                 Updating data...
              </td></tr>
            ) : filteredCompanies.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-secondary-500">No companies found.</td></tr>
            ) : (
              filteredCompanies.map((company) => (
                <tr key={company.id} className="hover:bg-secondary-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">{company.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{company.industry || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                    {company.website ? <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-800 hover:underline">{company.website}</a> : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{company.phone_office || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{new Date(company.updated_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(company)} aria-label={`Edit ${company.name}`}><EditIcon className="h-4 w-4" /></Button>
                    {hasRole(Role.ADMIN) && 
                        <Button variant="danger" size="sm" onClick={() => handleDeleteCompany(company.id)} aria-label={`Delete ${company.name}`}><DeleteIcon className="h-4 w-4" /></Button>
                    }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {isModalOpen && <CompanyModal isOpen={isModalOpen} onClose={handleCloseModal} companyToEdit={editingCompany} onSave={handleSaveCompany} />}
    </div>
  );
};
