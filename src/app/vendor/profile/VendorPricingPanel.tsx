import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

// Example: This would be fetched based on vendor profile
const vendorBusinessType = 'Plumbing';
const serviceCatalog = {
  'Plumbing': [
    'Kitchen Sink Repair',
    'Faucet Installation',
    'Garbage Disposal Repair',
    'Pipe Leak Fix',
    'Other',
  ],
  // ...other business types
};

export function VendorPricingPanel({ onClose }: { onClose?: () => void }) {
  const [pricing, setPricing] = useState<
    {
      service: string;
      price: string;
      custom?: boolean;
      pending?: boolean;
      enabled?: boolean;
    }[]
  >(
    serviceCatalog[vendorBusinessType].map((service) => ({
      service,
      price: "",
      custom: service === "Other",
      enabled: false,
    }))
  );
  const [customService, setCustomService] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [saved, setSaved] = useState(false);
  const [pendingCustomMessage, setPendingCustomMessage] = useState('');
  const [validationError, setValidationError] = useState('');

  const handlePriceChange = (idx: number, value: string) => {
    setPricing(pricing => pricing.map((p, i) => i === idx ? { ...p, price: value } : p));
  };

  const handleAddCustom = () => {
    if (customService && customPrice) {
      setPricing([
        ...pricing,
        { service: customService, price: customPrice, custom: true, pending: true },
      ]);
      setCustomService('');
      setCustomPrice('');
      setPendingCustomMessage('Your custom service is pending admin approval. You’ll be able to set a price and offer it to customers once approved.');
      setTimeout(() => setPendingCustomMessage(''), 4000);
    }
  };

  const handleDeleteCustom = (idx: number) => {
    setPricing(pricing => pricing.filter((_, i) => i !== idx));
  };

  const handleToggleService = (idx: number) => {
    setPricing(pricing => pricing.map((p, i) =>
      i === idx ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Require at least one core (catalog, not custom) service enabled and priced
    const hasCoreService = pricing.some(p => !p.custom && p.enabled && p.price && Number(p.price) > 0);
    if (!hasCoreService) {
      setValidationError('You must enable and set a price for at least one core service.');
      return;
    }
    setValidationError('');
    setSaved(true);
    // Would send pricing to backend here
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="relative w-full max-w-2xl">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-50 text-2xl text-gray-400 hover:text-gray-700 bg-white rounded-full w-10 h-10 flex items-center justify-center shadow"
          aria-label="Close"
        >
          ✕
        </button>
      )}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Update Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSave}>
            <div>
              <div className="grid grid-cols-2 gap-4 font-semibold mb-2">
                <span>Service</span>
                <span>Price ($)</span>
              </div>
              {pendingCustomMessage && (
                <div className="text-yellow-700 text-center font-medium mb-2">{pendingCustomMessage}</div>
              )}
              {validationError && (
                <div className="text-red-700 text-center font-medium mb-2">{validationError}</div>
              )}
              {pricing.map((p, idx) => (
                <div className="grid grid-cols-2 gap-4 mb-2 items-center" key={idx}>
                  <span className="flex items-center gap-2">
                    {!p.custom && (
                      <Checkbox
                        checked={p.enabled !== false}
                        onCheckedChange={() => handleToggleService(idx)}
                        className="mr-2"
                        aria-label={p.enabled !== false ? `Disable ${p.service}` : `Enable ${p.service}`}
                      />
                    )}
                    {p.service}
                    {p.custom && p.pending && (
                      <Badge className="bg-gray-200 text-gray-700 ml-2">Pending Approval</Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={p.price}
                      onChange={e => handlePriceChange(idx, e.target.value)}
                      placeholder="Enter price"
                      required
                      disabled={p.custom && p.pending || (!p.custom && p.enabled === false)}
                    />
                    {p.custom && (
                      <button
                        type="button"
                        className="ml-1 text-red-600 hover:text-red-800"
                        onClick={() => handleDeleteCustom(idx)}
                        aria-label="Delete custom service"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 mt-4">
              <div className="font-semibold mb-2">Add Custom Service</div>
              <div className="grid grid-cols-2 gap-4 mb-2">
                <Input
                  value={customService}
                  onChange={e => setCustomService(e.target.value)}
                  placeholder="Service name"
                />
                <Input
                  type="number"
                  min="0"
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                  placeholder="Price"
                />
              </div>
              <Button type="button" onClick={handleAddCustom} className="w-full mb-2">Add Service</Button>
            </div>
            <Button type="submit" className="w-full">Save Pricing</Button>
            {saved && <div className="text-green-700 text-center font-medium mt-2">Pricing saved!</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 