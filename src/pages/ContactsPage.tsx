
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { PlusIcon, EditIcon, DeleteIcon } from '@/components/common/Icons';
import { contactService, companyService } from '@/services/api';
import { Contact, Company, Role } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactToEdit: Contact | null;
  companies: Company[];
  onSave: (contact: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'company_name'> | Contact) => Promise<void>;
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, contactToEdit, companies, onSave }) => {
  const initialContactState: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'company_name'> = {
    first_name: '', last_name: '', email_primary: '', phone_work: '', phone_mobile: '', designation: '', company_id: ''
  };
  const [contactData, setContactData] = useState(initialContactState);
  const [isLoadingModal, setIsLoadingModal] = useState(false); 
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (contactToEdit) {
      setContactData({
        first_name: contactToEdit.first_name,
        last_name: contactToEdit.last_name,
        email_primary: contactToEdit.email_primary || '',
        phone_work: contactToEdit.phone_work || '',
        phone_mobile: contactToEdit.phone_mobile || '',
        designation: contactToEdit.designation || '',
        company_id: contactToEdit.company_id,
      });
    } else {
      setContactData(initialContactState);
    }
    setErrors({});
  }, [contactToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setContactData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({...prev, [name]: ''}));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!contactData.first_name.trim()) newErrors.first_name = "First name is required.";
    if (!contactData.last_name.trim()) newErrors.last_name = "Last name is required.";
    if (!contactData.company_id) newErrors.company_id = "Company is required.";
    if (contactData.email_primary && !/\S+@\S+\.\S+/.test(contactData.email_primary)) {
        newErrors.email_primary = "Please enter a valid email address.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoadingModal(true);
    try {
      const finalData: any = { ...contactData };
      if (contactToEdit?.id) finalData.id = contactToEdit.id;
      await onSave(finalData);
      onClose();
    } catch (error: any) {
      setErrors({ form: error.message || "Failed to save contact." });
    } finally {
      setIsLoadingModal(false);
    }
  };
  
  const companyOptions = companies.map(c => ({ value: c.id, label: c.name }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={contactToEdit ? "Edit Contact" : "Add New Contact"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="First Name" id="first_name" name="first_name" value={contactData.first_name} onChange={handleChange} error={errors.first_name} required disabled={isLoadingModal} />
            <Input label="Last Name" id="last_name" name="last_name" value={contactData.last_name} onChange={handleChange} error={errors.last_name} required disabled={isLoadingModal} />
        </div>
        <Select label="Company" id="company_id" name="company_id" value={contactData.company_id} onChange={handleChange} options={[{value: '', label: '-- Select Company --'}, ...companyOptions]} error={errors.company_id} required disabled={isLoadingModal || companies.length === 0} placeholder="-- Select Company --" />
        <Input label="Email (Primary)" id="email_primary" name="email_primary" type="email" value={contactData.email_primary || ''} onChange={handleChange} error={errors.email_primary} disabled={isLoadingModal} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Work Phone" id="phone_work" name="phone_work" type="tel" value={contactData.phone_work || ''} onChange={handleChange} disabled={isLoadingModal} />
            <Input label="Mobile Phone" id="phone_mobile" name="phone_mobile" type="tel" value={contactData.phone_mobile || ''} onChange={handleChange} disabled={isLoadingModal} />
        </div>
        <Input label="Designation/Title" id="designation" name="designation" value={contactData.designation || ''} onChange={handleChange} disabled={isLoadingModal} />
        
        {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoadingModal}>Cancel</Button>
          <Button type="submit" isLoading={isLoadingModal} disabled={isLoadingModal}>{contactToEdit ? "Save Changes" : "Add Contact"}</Button>
        </div>
      </form>
    </Modal>
  );
};

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const { profile: currentUserProfile, hasRole } = useAuth();

  const fetchData = useCallback(async (options?: {isInitialLoad?: boolean}) => {
    const {isInitialLoad = false} = options || {};
    if (!currentUserProfile?.org_id) {
        if(isInitialLoad) setPageLoading(false);
        setIsDataLoading(false);
        setContacts([]);
        if(isInitialLoad) setCompanies([]);
        return;
    }
    
    if (isInitialLoad) {
        setPageLoading(true);
    } else {
        setIsDataLoading(true);
    }

    try {
      const promises: (Promise<Contact[]> | Promise<Company[]>)[] = [
        contactService.getContacts(currentUserProfile.org_id),
      ];
      if (isInitialLoad) {
        promises.push(companyService.getCompanies(currentUserProfile.org_id));
      }
      
      const results = await Promise.all(promises);
      setContacts(results[0] as Contact[]);
      if (isInitialLoad && results.length > 1 && results[1]) {
        setCompanies(results[1] as Company[]);
      }
    } catch (error) {
      console.error("Failed to fetch contacts or companies:", error);
      alert(`Error fetching data: ${(error as Error).message}`);
      setContacts([]);
      if(isInitialLoad) setCompanies([]);
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
        setContacts([]);
        setCompanies([]);
    }
  }, [currentUserProfile?.org_id, fetchData]);

  const refreshContactsData = () => {
    fetchData({isInitialLoad: false});
  };

  const handleOpenModal = (contact: Contact | null = null) => {
    setEditingContact(contact);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingContact(null);
  };

  const handleSaveContact = async (contactData: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'company_name'> | Contact) => {
    if (!currentUserProfile?.org_id) throw new Error("Organization ID is missing.");
    setIsDataLoading(true);
    try {
        if ('id' in contactData && contactData.id) {
        const { id, org_id, created_at, updated_at, company_name, ...dataToUpdate } = contactData as Contact;
        await contactService.updateContact(id, dataToUpdate);
        } else {
        await contactService.addContact(contactData as Omit<Contact, 'id'|'created_at'|'updated_at'|'org_id'|'company_name'>, currentUserProfile.org_id);
        }
        refreshContactsData();
    } catch (error) {
        console.error("Error saving contact:", error);
        setIsDataLoading(false);
        throw error; 
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (window.confirm("Are you sure you want to delete this contact? This will also unlink it from associated leads and deals.")) {
      setIsDataLoading(true);
      try {
        await contactService.deleteContact(contactId);
        refreshContactsData();
      } catch (error) {
        console.error("Failed to delete contact:", error);
        alert(`Error deleting contact: ${(error as Error).message}`);
      } finally {
        setIsDataLoading(false);
      }
    }
  };
  
  const filteredContacts = contacts.filter(contact => {
    const searchTermLower = searchTerm.toLowerCase();
    const nameMatch = `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchTermLower);
    const emailMatch = contact.email_primary && contact.email_primary.toLowerCase().includes(searchTermLower);
    const companyNameMatch = contact.company_name && contact.company_name.toLowerCase().includes(searchTermLower);
    const designationMatch = contact.designation && contact.designation.toLowerCase().includes(searchTermLower);
    
    const companyFilterMatch = filterCompany ? contact.company_id === filterCompany : true;

    return (nameMatch || emailMatch || companyNameMatch || designationMatch) && companyFilterMatch;
  });

  const companyOptionsForFilter = [{value: '', label: 'All Companies'}, ...companies.map(c => ({ value: c.id, label: c.name }))];

  if (pageLoading) {
      return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-secondary-900">Contact Management</h1>
        <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={isDataLoading || companies.length === 0}>
          Add New Contact
        </Button>
      </div>
      {companies.length === 0 && !pageLoading && (
        <p className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-md text-sm">
            Please add companies first to be able to associate contacts.
        </p>
      )}

      <div className="mb-6 p-4 bg-white shadow rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search contacts"
            />
             <Select
                name="filterCompany"
                label="Filter by Company"
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                options={companyOptionsForFilter}
                disabled={companies.length === 0}
                aria-label="Filter contacts by company"
            />
        </div>
      </div>
      
      <div className="bg-white shadow overflow-x-auto rounded-lg">
        <table className="min-w-full divide-y divide-secondary-200" aria-label="Contacts Table">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Company</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Designation</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Work Phone</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {isDataLoading && contacts.length > 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center relative">
                <div className="absolute inset-0 bg-white bg-opacity-50 flex justify-center items-center"><Spinner /></div>
                Updating data...
              </td></tr>
            ) : filteredContacts.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-secondary-500">No contacts found.</td></tr>
            ) : (
              filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-secondary-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">{contact.first_name} {contact.last_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{contact.email_primary || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{contact.company_name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{contact.designation || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{contact.phone_work || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(contact)} aria-label={`Edit ${contact.first_name}`}><EditIcon className="h-4 w-4" /></Button>
                     {hasRole(Role.ADMIN) && 
                        <Button variant="danger" size="sm" onClick={() => handleDeleteContact(contact.id)} aria-label={`Delete ${contact.first_name}`}><DeleteIcon className="h-4 w-4" /></Button>
                     }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {isModalOpen && <ContactModal isOpen={isModalOpen} onClose={handleCloseModal} contactToEdit={editingContact} companies={companies} onSave={handleSaveContact} />}
    </div>
  );
};
