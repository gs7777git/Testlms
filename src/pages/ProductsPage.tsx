import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { PlusIcon, EditIcon, DeleteIcon, UploadIcon } from '@/components/common/Icons';
import { productService } from '@/services/api';
import { Product, Role } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit: Product | null;
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'org_id'> | Product) => Promise<void>;
}


const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, productToEdit, onSave }) => {
  const initialProductState: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'org_id'> = { name: '', description: '', price: 0 };
  const [productData, setProductData] = useState(initialProductState);
  const [isLoadingModal, setIsLoadingModal] = useState(false); 
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (productToEdit) {
      setProductData({
        name: productToEdit.name,
        description: productToEdit.description || '',
        price: productToEdit.price,
      });
    } else {
      setProductData(initialProductState);
    }
    setErrors({});
  }, [productToEdit, isOpen]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProductData(prev => ({ ...prev, [name]: name === 'price' ? parseFloat(value) || 0 : value }));
    if (errors[name]) setErrors(prev => ({...prev, [name]: ''}));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!productData.name.trim()) newErrors.name = "Product name is required.";
    if (productData.price < 0) newErrors.price = "Price cannot be negative.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoadingModal(true);
    try {
      const finalData: any = { ...productData };
      if (productToEdit?.id) finalData.id = productToEdit.id;
      await onSave(finalData);
      onClose();
    } catch (error: any) {
      setErrors({ form: error.message || "Failed to save product." });
    } finally {
      setIsLoadingModal(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={productToEdit ? "Edit Product" : "Add New Product"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Product Name" id="name" name="name" value={productData.name} onChange={handleChange} error={errors.name} required disabled={isLoadingModal} />
        <Textarea label="Description (Optional)" id="description" name="description" value={productData.description || ''} onChange={handleChange} rows={3} disabled={isLoadingModal} />
        <Input label="Price" id="price" name="price" type="number" step="0.01" value={productData.price.toString()} onChange={handleChange} error={errors.price} required disabled={isLoadingModal} />
        {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoadingModal}>Cancel</Button>
          <Button type="submit" isLoading={isLoadingModal} disabled={isLoadingModal}>{productToEdit ? "Save Changes" : "Add Product"}</Button>
        </div>
      </form>
    </Modal>
  );
};

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const { profile: currentUserProfile, hasRole } = useAuth();

  const fetchData = useCallback(async (options?: {isInitialLoad?: boolean}) => {
    const {isInitialLoad = false} = options || {};
    if (!currentUserProfile?.org_id || !hasRole(Role.ADMIN)) {
      if(isInitialLoad) setPageLoading(false);
      setIsDataLoading(false);
      setProducts([]); 
      return;
    }

    if (isInitialLoad) {
        setPageLoading(true);
    } else {
        setIsDataLoading(true);
    }

    try {
      const fetchedProducts = await productService.getProducts(currentUserProfile.org_id);
      setProducts(fetchedProducts);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      alert(`Error fetching products: ${(error as Error).message}`);
      setProducts([]);
    } finally {
      if(isInitialLoad) {
        setPageLoading(false);
      }
      setIsDataLoading(false);
    }
  }, [currentUserProfile?.org_id, hasRole]);

  useEffect(() => {
    if (currentUserProfile && hasRole(Role.ADMIN)) { 
        fetchData({isInitialLoad: true});
    } else {
        setPageLoading(false);
        setIsDataLoading(false);
        setProducts([]);
    }
  }, [currentUserProfile, hasRole, fetchData]); 

  const refreshProductsData = () => {
    fetchData({isInitialLoad: false});
  };

  const handleOpenModal = (product: Product | null = null) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSaveProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'org_id'> | Product) => {
    if (!currentUserProfile?.org_id) throw new Error("Organization ID is missing.");
    setIsDataLoading(true);
    try {
        if ('id' in productData && productData.id) {
        const { id, org_id, created_at, updated_at, ...dataToUpdate } = productData as Product;
        await productService.updateProduct(id, dataToUpdate);
        } else {
        await productService.addProduct(productData as Omit<Product, 'id'|'created_at'|'updated_at'|'org_id'>, currentUserProfile.org_id);
        }
        refreshProductsData();
    } catch(error) {
        console.error("Error saving product:", error);
        throw error; 
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm("Are you sure you want to delete this product? This might affect existing deals if not handled by backend constraints.")) {
      setIsDataLoading(true);
      try {
        await productService.deleteProduct(productId);
        refreshProductsData();
      } catch (error) {
        console.error("Failed to delete product:", error);
        alert(`Error deleting product: ${(error as Error).message}`);
      } finally {
        setIsDataLoading(false);
      }
    }
  };
  
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setCsvFile(event.target.files[0]);
      setUploadMessage(null);
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile || !currentUserProfile?.org_id) return;
    setIsUploading(true);
    setUploadMessage(null);
    try {
      const fileContent = await csvFile.text();
      const lines = fileContent.split(/\r\n|\n/).filter(line => line.trim() !== '');
      if (lines.length <= 1) throw new Error("CSV file is empty or has only a header.");
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIndex = headers.indexOf('name');
      const priceIndex = headers.indexOf('price');
      const descriptionIndex = headers.indexOf('description');

      if (nameIndex === -1 || priceIndex === -1) {
        throw new Error("CSV must contain 'name' and 'price' columns.");
      }

      const productsToImport: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'org_id'>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const name = values[nameIndex]?.trim();
        const price = parseFloat(values[priceIndex]?.trim());
        const description = descriptionIndex !== -1 ? values[descriptionIndex]?.trim() : '';

        if (name && !isNaN(price)) {
          productsToImport.push({ name, price, description });
        } else {
            console.warn(`Skipping invalid line ${i+1}: ${lines[i]}`);
        }
      }
      
      if (productsToImport.length > 0) {
        await productService.bulkAddProducts(productsToImport, currentUserProfile.org_id);
        setUploadMessage({type: 'success', text: `${productsToImport.length} products imported successfully!`});
        refreshProductsData();
      } else {
        setUploadMessage({type: 'error', text: 'No valid products found in CSV to import.'});
      }
      setCsvFile(null); 
      const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';


    } catch (error: any) {
      console.error("CSV Import error:", error);
      setUploadMessage({type: 'error', text: `Import failed: ${error.message}`});
    } finally {
      setIsUploading(false);
    }
  };


  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (pageLoading) {
    return <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>;
  }

  if (!hasRole(Role.ADMIN)) {
    return <p className="text-red-500 p-4 bg-red-50 rounded-md">You do not have permission to view this page.</p>;
  }
  
  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-secondary-900">Product Management</h1>
        <Button onClick={() => handleOpenModal()} leftIcon={<PlusIcon className="h-5 w-5" />} disabled={isDataLoading}>
          Add New Product
        </Button>
      </div>

      <div className="mb-6 p-4 bg-white shadow rounded-lg">
        <h3 className="text-lg font-medium text-secondary-700 mb-2">Import Products (CSV)</h3>
        <div className="flex flex-col sm:flex-row items-end gap-2">
          <Input 
            type="file" 
            id="csv-upload"
            accept=".csv" 
            onChange={handleFileChange} 
            wrapperClassName="flex-grow"
            label="Select CSV File (columns: name, price, description (optional))"
            aria-describedby="csv-upload-message"
          />
          <Button 
            onClick={handleCsvImport} 
            leftIcon={<UploadIcon className="h-5 w-5"/>} 
            isLoading={isUploading} 
            disabled={!csvFile || isUploading || isDataLoading}
            size="md"
            className="sm:w-auto w-full mt-2 sm:mt-0"
          >
            Import CSV
          </Button>
        </div>
         {uploadMessage && <p id="csv-upload-message" className={`mt-2 text-sm ${uploadMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`} role={uploadMessage.type === 'error' ? 'alert' : 'status'}>{uploadMessage.text}</p>}
      </div>


      <div className="mb-4">
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search products"
        />
      </div>
      
      <div className="bg-white shadow overflow-x-auto rounded-lg">
        <table className="min-w-full divide-y divide-secondary-200" aria-label="Products Table">
          <thead className="bg-secondary-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Description</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Price</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Last Updated</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-secondary-200">
            {isDataLoading && products.length > 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center relative">
                  <div className="absolute inset-0 bg-white bg-opacity-50 flex justify-center items-center"><Spinner /></div>
                  Updating data...
              </td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-secondary-500">No products found.</td></tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-secondary-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-secondary-900">{product.name}</td>
                  <td className="px-6 py-4 whitespace-normal text-sm text-secondary-500 max-w-xs truncate" title={product.description}>{product.description || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">${product.price.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">{new Date(product.updated_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(product)} aria-label={`Edit ${product.name}`}><EditIcon className="h-4 w-4" /></Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteProduct(product.id)} aria-label={`Delete ${product.name}`}><DeleteIcon className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {isModalOpen && <ProductModal isOpen={isModalOpen} onClose={handleCloseModal} productToEdit={editingProduct} onSave={handleSaveProduct} />}
    </div>
  );
};