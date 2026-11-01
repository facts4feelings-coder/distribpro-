import { useRef, useEffect } from 'react';
import { Plus, Trash2, ScanLine, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/lib/types';

interface LineItem {
  product_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  total: string;
}

export default function InvoiceLineItems({
  items,
  products,
  sym,
  customerRates = {},
  customerName = '',
  onUpdateItem,
  onProductSelect,
  onAddItem,
  onRemoveItem,
  onBarcodeScan,
}: {
  items: LineItem[];
  products: Product[];
  sym: string;
  customerRates?: Record<string, number>;
  customerName?: string;
  onUpdateItem: (idx: number, field: string, value: string) => void;
  onProductSelect: (idx: number, productId: string) => void;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  onBarcodeScan?: (productId: string) => void;
}) {
  // Grid of refs: each row has [product, rate, discount] inputs
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, items.length);
  }, [items.length]);

  const focusCell = (rowIdx: number, colIdx: number) => {
    const ref = inputRefs.current[rowIdx]?.[colIdx];
    if (ref) ref.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (colIdx < 2) {
        // Move to next column (product -> rate -> discount)
        focusCell(rowIdx, colIdx + 1);
      } else {
        // Last column: add new row and focus its first cell
        onAddItem();
        setTimeout(() => focusCell(rowIdx + 1, 0), 10);
      }
    }
  };

  const handleBarcode = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = e.currentTarget.value.trim();
    if (!code) return;
    const product = products.find(
      (p) => (p.sku ?? '').toLowerCase() === code.toLowerCase() || String(p.id) === code
    );
    if (product && onBarcodeScan) {
      onBarcodeScan(product.id);
      e.currentTarget.value = '';
      barcodeRef.current?.focus();
    } else {
      alert(`No product found for barcode "${code}". Check the product's SKU in Products & Stock.`);
      e.currentTarget.select();
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {onBarcodeScan && (
        <div className="bg-blue-50/60 px-4 py-2.5 flex items-center gap-2 border-b border-blue-100">
          <ScanLine size={16} className="text-blue-600 flex-shrink-0" />
          <input
            ref={barcodeRef}
            onKeyDown={handleBarcode}
            className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
            placeholder="Scan barcode or type SKU, then press Enter to add the product..."
            autoComplete="off"
          />
        </div>
      )}

      <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Line Items — Type product name, press Tab to rate, Enter for next row</span>
        <button onClick={onAddItem} className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-all">
          <Plus size={14} /> Add Item
        </button>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100/50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
        <div className="col-span-4">Product</div>
        <div className="col-span-2 text-right">Qty</div>
        <div className="col-span-2 text-right">Rate</div>
        <div className="col-span-1 text-right">Disc %</div>
        <div className="col-span-2 text-right">Total</div>
        <div className="col-span-1"></div>
      </div>

      {/* Item rows */}
      <div className="divide-y divide-slate-100">
        {items.map((item, idx) => {
          const matchedProduct =
            products.find((p) => p.id === item.product_id) ??
            products.find((p) => p.name.toLowerCase() === item.product_name.trim().toLowerCase());
          const qty = parseFloat(item.quantity) || 0;
          const rate = parseFloat(item.unit_price) || 0;
          const stock = matchedProduct?.stock_quantity ?? null;
          const overStock = stock !== null && qty > stock;
          const soldOut = stock !== null && stock <= 0;
          const lossPerUnit = matchedProduct && rate > 0 && rate < matchedProduct.purchase_price
            ? matchedProduct.purchase_price - rate : 0;
          return (
          <div key={idx} className={`grid grid-cols-12 gap-2 p-2 items-center ${overStock || lossPerUnit > 0 ? 'bg-rose-50/40' : ''}`}>
            {/* Product name with datalist autocomplete */}
            <div className="col-span-4">
              <input
                list={`product-list-${idx}`}
                ref={(el) => {
                  if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                  inputRefs.current[idx][0] = el;
                }}
                value={item.product_name}
                onChange={(e) => {
                  onUpdateItem(idx, 'product_name', e.target.value);
                  // Check if value matches a product for auto-fill rate
                  const matched = products.find((p) => p.name.toLowerCase() === e.target.value.toLowerCase());
                  if (matched) onProductSelect(idx, matched.id);
                }}
                onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                className="input text-sm"
                placeholder="Product name"
                autoComplete="off"
              />
              <datalist id={`product-list-${idx}`}>
                {products.map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
              {matchedProduct && (
                <div className="mt-1 space-y-0.5">
                  <p className={`text-[11px] font-medium ${soldOut ? 'text-rose-600' : overStock ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {soldOut
                      ? 'Out of stock — cannot be sold'
                      : overStock
                        ? `Only ${stock} in stock (you are selling ${qty})`
                        : `In stock: ${stock}`}
                  </p>
                  {customerRates[matchedProduct.id] != null && (
                    <p className="text-[11px] text-slate-500">
                      {customerName || 'This customer'} last bought at {formatCurrency(customerRates[matchedProduct.id], sym)}
                    </p>
                  )}
                  {lossPerUnit > 0 && (
                    <p className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                      <AlertTriangle size={11} /> Selling below cost — loss of {formatCurrency(lossPerUnit, sym)} per unit
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="col-span-2">
              <input
                type="number"
                step="0.01"
                value={item.quantity}
                onChange={(e) => onUpdateItem(idx, 'quantity', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                className="input text-sm text-right"
                placeholder="Qty"
              />
            </div>

            {/* Rate */}
            <div className="col-span-2">
              <input
                type="number"
                step="0.01"
                ref={(el) => {
                  if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                  inputRefs.current[idx][1] = el;
                }}
                value={item.unit_price}
                onChange={(e) => onUpdateItem(idx, 'unit_price', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                className="input text-sm text-right"
                placeholder="Rate"
              />
            </div>

            {/* Discount % */}
            <div className="col-span-1">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                ref={(el) => {
                  if (!inputRefs.current[idx]) inputRefs.current[idx] = [];
                  inputRefs.current[idx][2] = el;
                }}
                value={item.discount_percent}
                onChange={(e) => onUpdateItem(idx, 'discount_percent', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                className="input text-sm text-right"
                placeholder="0"
              />
            </div>

            {/* Total */}
            <div className="col-span-2 text-right text-sm font-bold text-slate-800">
              {formatCurrency(parseFloat(item.total) || 0, sym)}
            </div>

            {/* Delete */}
            <div className="col-span-1 flex justify-end">
              {items.length > 1 && (
                <button onClick={() => onRemoveItem(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-all">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
