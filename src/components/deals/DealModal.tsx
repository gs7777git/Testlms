
import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Spinner } from '@/components/common/Spinner';
import { PlusIcon, DeleteIcon } from '@/components/common/Icons';
import { Deal, DealStatus, DealItem, Lead, Product, UserProfile, Company, Contact } from '@/types';
import { DEAL_STATUS_OPTIONS } from '@/constants';
import { dealService, productService, leadService, companyService, contactService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface DealModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead?: Lead | null; // Pre-selected lead for creating a new deal from LeadModal
  dealToEdit?: Deal | null; // Deal being edited
}

const initialDealItemState: Omit<DealItem, 'id' | 'deal_id' | 'product_name' | 'total_price' | 'created_at'> = {
  product_id: '',
  quantity: 1,
  unit_price: 0,
};

const MODAL_TITLE_ID = "deal-modal-title";

export const DealModal: React.FC<DealModalProps> = ({ isOpen, onClose, lead: preselectedLead, dealToEdit }) => {
  const { profile: currentUserProfile } = useAuth();
  
  const [dealData, setDealData] = useState<Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'org_id' | 'lead_id' | 'created_by_user_id' | 'created_by_user_name' | 'total_value' | 'items' | 'lead_name' | 'company_name' | 'contact_name'>>(
    { deal_name: '', status: DealStatus.DRAFT, company_id: null, contact_id: null }
  );
  // selectedLeadId is crucial for selecting a lead when creating a deal from DealsPage
  // or confirming the lead when editing or creating from LeadModal.
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  
  const [items, setItems] = useState<DealItem[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableLeads, setAvailableLeads] = useState<Lead[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [contactsForSelectedCompany, setContactsForSelectedCompany] = useState<Contact[]>([]);
  
  const [currentProductSelection, setCurrentProductSelection] = useState<string>(''); 

  const [isLoading, setIsLoading] = useState(false); 
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isLeadsLoading, setIsLeadsLoading] = useState(false);
  const [isCompaniesLoading, setIsCompaniesLoading] = useState(false);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const calculateTotalValue = useCallback((currentItems: DealItem[]) => {
    return currentItems.reduce((sum, item) => sum + item.total_price, 0);
  }, []);

  useEffect(() => {
    if (isOpen && currentUserProfile?.org_id) {
      setIsProductsLoading(true);
      productService.getProducts(currentUserProfile.org_id)
        .then(setAvailableProducts)
        .catch(err => console.error("Failed to fetch products", err))
        .finally(() => setIsProductsLoading(false));

      // Fetch all leads only if not editing and no lead is preselected (i.e., creating from DealsPage)
      if (!dealToEdit && !preselectedLead) {
        setIsLeadsLoading(true);
        leadService.getLeads(currentUserProfile.org_id)
          .then(setAvailableLeads)
          .catch(err => console.error("Failed to fetch leads", err))
          .finally(() => setIsLeadsLoading(false));
      } else if (preselectedLead) {
        setAvailableLeads([preselectedLead]); // Use preselected lead if available
        setSelectedLeadId(preselectedLead.id);
      }
      
      setIsCompaniesLoading(true);
      companyService.getCompanies(currentUserProfile.org_id)
        .then(setAvailableCompanies)
        .catch(err => console.error("Failed to fetch companies", err))
        .finally(() => setIsCompaniesLoading(false));
    }
  }, [isOpen, currentUserProfile?.org_id, dealToEdit, preselectedLead]); // Added dealToEdit and preselectedLead


  useEffect(() => {
    if (isOpen) {
      if (dealToEdit) {
        setDealData({
          deal_name: dealToEdit.deal_name,
          status: dealToEdit.status,
          company_id: dealToEdit.company_id || null,
          contact_id: dealToEdit.contact_id || null,
        });
        setSelectedLeadId(dealToEdit.lead_id); // Set the lead for the deal being edited
        setItems(dealToEdit.items.map(item => ({ ...item }))); 

        // Ensure the lead of the deal being edited is in the availableLeads list
        if (dealToEdit.lead_id && !availableLeads.some(l => l.id === dealToEdit.lead_id) && currentUserProfile?.org_id) {
            setIsLeadsLoading(true);
            leadService.getLeadDetails(dealToEdit.lead_id, currentUserProfile.org_id)
                .then(leadDetail => {
                    if (leadDetail) setAvailableLeads(prev => [leadDetail, ...prev.filter(l=> l.id !== leadDetail.id)]);
                })
                .catch(err => console.error("Failed to fetch specific lead details for edit", err))
                .finally(() => setIsLeadsLoading(false));
        }

      } else { // New deal
        setDealData({ 
            deal_name: preselectedLead ? `Deal for ${preselectedLead.name}` : '', 
            status: DealStatus.DRAFT, 
            company_id: preselectedLead?.company_id || null, 
            contact_id: preselectedLead?.contact_id || null 
        });
        setSelectedLeadId(preselectedLead?.id || '');
        setItems([]);
      }
      setCurrentProductSelection('');
      setErrors({});
    }
  }, [dealToEdit, isOpen, preselectedLead, currentUserProfile?.org_id, availableLeads]); // Added availableLeads

  // Fetch contacts when selected company changes
  useEffect(() => {
    const companyId = dealData.company_id;
    if (isOpen && companyId && currentUserProfile?.org_id) {
      setIsContactsLoading(true);
      contactService.getContactsForCompany(companyId, currentUserProfile.org_id)
        .then(fetchedContacts => {
          setContactsForSelectedCompany(fetchedContacts);
          if (dealData.contact_id && !fetchedContacts.some(c => c.id === dealData.contact_id)) {
            setDealData(prev => ({ ...prev, contact_id: null }));
          }
        })
        .catch(err => {
          console.error("Failed to fetch contacts for selected company:", err);
          setContactsForSelectedCompany([]);
          setDealData(prev => ({ ...prev, contact_id: null }));
        })
        .finally(() => setIsContactsLoading(false));
    } else if (!companyId) {
      setContactsForSelectedCompany([]);
      setDealData(prev => ({ ...prev, contact_id: null }));
    }
  }, [dealData.company_id, isOpen, currentUserProfile?.org_id, dealData.contact_id]);


  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
     let processedValue: string | null = value;
    if ((name === 'company_id' || name === 'contact_id') && value === '') {
        processedValue = null;
    }
    setDealData(prev => ({ ...prev, [name]: processedValue }));
    if (name === 'company_id') { 
        setDealData(prev => ({ ...prev, contact_id: null }));
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleItemChange = (index: number, field: keyof DealItem, value: string | number) => {
    const newItems = [...items];
    const itemToUpdate = { ...newItems[index] };
    (itemToUpdate[field] as any) = value; 

    if (field === 'product_id') {
      const product = availableProducts.find(p => p.id === value);
      itemToUpdate.product_name = product?.name || 'N/A';
      itemToUpdate.unit_price = product?.price || 0;
    }
    if (field === 'quantity' || field === 'unit_price') {
        itemToUpdate.quantity = field === 'quantity' ? Math.max(1, Number(value)) : itemToUpdate.quantity;
        itemToUpdate.unit_price = field === 'unit_price' ? Number(value) : itemToUpdate.unit_price;
    }
    itemToUpdate.total_price = itemToUpdate.quantity * itemToUpdate.unit_price;
    newItems[index] = itemToUpdate;
    setItems(newItems);
  };

  const handleAddItem = () => {
    if (!currentProductSelection) {
        setErrors(prev => ({...prev, itemsList: "Please select a product to add."}));
        return;
    }
    const product = availableProducts.find(p => p.id === currentProductSelection);
    if (!product) {
        setErrors(prev => ({...prev, itemsList: "Selected product not found."}));
        return;
    }
    setItems(prevItems => [
      ...prevItems,
      {
        id: `temp-${Date.now()}-${prevItems.length}`, 
        deal_id: dealToEdit?.id || '', 
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        total_price: product.price,
      },
    ]);
    setCurrentProductSelection(''); 
    setErrors(prev => ({...prev, itemsList: ''})); 
  };

  const handleRemoveItem = (itemIndex: number) => {
    setItems(prevItems => prevItems.filter((_, i) => i !== itemIndex));
  };
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!dealData.deal_name.trim()) newErrors.deal_name = 'Deal name is required.';
    if (!selectedLeadId) newErrors.selectedLeadId = 'Associated lead is required.';
    if (!dealData.status) newErrors.status = 'Status is required.';
    if (items.length === 0) newErrors.itemsListValidation = 'At least one item is required for a deal.';
    items.forEach((item, index) => {
        if(!item.product_id) newErrors[`item_product_${index}`] = `Product for item ${index+1} is required.`;
        if(item.quantity <= 0) newErrors[`item_quantity_${index}`] = `Quantity for item ${index+1} must be positive.`;
        if(item.unit_price < 0) newErrors[`item_price_${index}`] = `Unit price for item ${index+1} cannot be negative.`;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!currentUserProfile?.org_id || !currentUserProfile.id) {
      setErrors(prev => ({ ...prev, form: "User or Organization context is missing."}));
      return;
    }

    setIsLoading(true);
    const apiItemsData = items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price }));
    
    const finalDealDataSubmit = {
        ...dealData,
        lead_id: selectedLeadId,
    };

    try {
      if (dealToEdit) {
        await dealService.updateDeal(dealToEdit.id, finalDealDataSubmit, apiItemsData);
      } else {
        await dealService.addDeal(finalDealDataSubmit as Deal & {lead_id: string}, apiItemsData, currentUserProfile.org_id, currentUserProfile.id);
      }
      onClose(); 
    } catch (error: any) {
      console.error("Error saving deal:", error);
      setErrors(prev => ({ ...prev, form: error.message || 'Failed to save deal.' }));
    } finally {
      setIsLoading(false);
    }
  };
  
  const totalDealValue = calculateTotalValue(items);
  const statusOptions = DEAL_STATUS_OPTIONS.map(s => ({ value: s, label: s }));
  const productOptionsForSelect = [{value: '', label: '-- Select Product --'}, ...availableProducts.map(p => ({ value: p.id, label: `${p.name} ($${p.price.toFixed(2)})` }))];
  const leadOptionsForSelect = [{value: '', label: '-- Select Lead --'}, ...availableLeads.map(l => ({ value: l.id, label: l.name }))];
  const companyOptionsForSelect = [{value: '', label: 'None'}, ...availableCompanies.map(c => ({value: c.id, label: c.name}))];
  const contactOptionsForSelect = [{value: '', label: 'None'}, ...contactsForSelectedCompany.map(c => ({value: c.id, label: `${c.first_name} ${c.last_name}`}))];


  const modalTitle = dealToEdit ? `Edit Deal: ${dealData.deal_name || dealToEdit.deal_name}` : 'Add New Deal / Quotation';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} titleId={MODAL_TITLE_ID} size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Deal Details Section */}
        <div className="space-y-4 p-4 border border-secondary-200 rounded-md">
            <h3 className="text-lg font-medium text-secondary-800 mb-3">Deal Information</h3>
            <Input label="Deal Name / Title" id="deal_name" name="deal_name" value={dealData.deal_name} onChange={handleChange} error={errors.deal_name} required disabled={isLoading} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Select 
                    label="Associated Lead" id="selectedLeadId" name="selectedLeadId" value={selectedLeadId} 
                    onChange={(e) => setSelectedLeadId(e.target.value)} options={leadOptionsForSelect} error={errors.selectedLeadId} 
                    required disabled={isLoading || isLeadsLoading || !!preselectedLead || !!dealToEdit} 
                    placeholder={isLeadsLoading ? "Loading leads..." : (availableLeads.length === 0 && !preselectedLead && !dealToEdit ? "No leads available" : "-- Select Lead --")}
                />
                <Select label="Status" id="status" name="status" value={dealData.status} onChange={handleChange} options={statusOptions} error={errors.status} required disabled={isLoading} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Select label="Company (Optional)" id="company_id" name="company_id" value={dealData.company_id || ''} onChange={handleChange} options={companyOptionsForSelect} error={errors.company_id} disabled={isLoading || isCompaniesLoading} placeholder={isCompaniesLoading ? "Loading..." : "None"} />
                 <Select label="Contact (Optional)" id="contact_id" name="contact_id" value={dealData.contact_id || ''} onChange={handleChange} options={contactOptionsForSelect} error={errors.contact_id} disabled={isLoading || isContactsLoading || !dealData.company_id || contactsForSelectedCompany.length === 0} placeholder={isContactsLoading ? "Loading..." : (dealData.company_id && contactsForSelectedCompany.length === 0 ? "No contacts for company" : "None")} />
            </div>
        </div>
        
        {/* Items Section */}
        <div className="space-y-4 p-4 border border-secondary-200 rounded-md">
            <h3 className="text-lg font-medium text-secondary-800 mb-3">Products / Services</h3>
            {errors.itemsListValidation && <p className="text-sm text-red-600 mb-2">{errors.itemsListValidation}</p>}
            {items.map((item, index) => (
            <div key={item.id || `item-${index}`} className="grid grid-cols-12 gap-x-3 gap-y-2 items-end p-2 border-b border-secondary-100 last:border-b-0">
                <Select label={`Item ${index + 1}`} wrapperClassName="col-span-12 sm:col-span-5" id={`item_product_${index}`} name="product_id" value={item.product_id}
                    onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                    options={productOptionsForSelect} error={errors[`item_product_${index}`]} disabled={isLoading || isProductsLoading} placeholder="Select Product"
                />
                <Input label="Qty" wrapperClassName="col-span-4 sm:col-span-2" id={`item_quantity_${index}`} name="quantity" type="number" min="1" value={item.quantity.toString()}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10))}
                    error={errors[`item_quantity_${index}`]} disabled={isLoading}
                />
                <Input label="Unit Price ($)" wrapperClassName="col-span-4 sm:col-span-2" id={`item_price_${index}`} name="unit_price" type="number" step="0.01" value={item.unit_price.toString()}
                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                    error={errors[`item_price_${index}`]} disabled={isLoading}
                />
                <div className="col-span-4 sm:col-span-2 text-sm py-2 font-medium text-secondary-700 self-center whitespace-nowrap">
                    Total: ${item.total_price.toFixed(2)}
                </div>
                <div className="col-span-12 sm:col-span-1 flex justify-end sm:justify-center">
                    <Button type="button" variant="danger" size="sm" onClick={() => handleRemoveItem(index)} disabled={isLoading} className="p-1.5 !h-8 !w-8" aria-label={`Remove item ${index + 1}`}>
                        <DeleteIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            ))}
            <div className="flex items-end space-x-3 mt-3">
                 <Select label="Add Product" id="currentProductSelection" name="currentProductSelection" value={currentProductSelection} 
                    onChange={(e) => setCurrentProductSelection(e.target.value)} options={productOptionsForSelect} wrapperClassName="flex-grow"
                    disabled={isLoading || isProductsLoading} placeholder={isProductsLoading ? "Loading products..." : (availableProducts.length === 0 ? "No products available" : "-- Select Product to Add --")}
                    error={errors.itemsList}
                />
                <Button type="button" onClick={handleAddItem} leftIcon={<PlusIcon className="h-4 w-4" />} size="md" disabled={isLoading || !currentProductSelection}>Add Item</Button>
            </div>
        </div>

        <div className="mt-6 p-4 bg-secondary-50 rounded-md flex justify-end items-center">
            <span className="text-xl font-semibold text-secondary-800">Total Deal Value:</span>
            <span className="text-2xl font-bold text-primary-700 ml-3">${totalDealValue.toFixed(2)}</span>
        </div>
        
        {errors.form && <p className="mt-2 text-sm text-red-600 text-center">{errors.form}</p>}
        <div className="pt-5 flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading} disabled={isLoading}>{dealToEdit ? 'Save Changes' : 'Create Deal'}</Button>
        </div>
      </form>
    </Modal>
  );
};
