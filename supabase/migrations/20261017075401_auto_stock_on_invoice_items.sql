/*
# Auto stock updates on sale and purchase

1. Purpose
   Stock quantity was never decreasing when a sale was recorded because the
   application only inserted invoice rows; nothing adjusted products.stock_quantity.

2. Changes
   - Adds a trigger function `adjust_stock_on_invoice_item()` that runs after every
     insert/update/delete on customer_invoice_items and supplier_invoice_items.
   - Sale invoices (customer_invoices with invoice_type = 'sale') decrease stock.
   - Sales returns (customer_invoices with invoice_type = 'sales_return') increase stock.
   - Purchase invoices (supplier_invoices with invoice_type = 'purchase') increase stock.
   - Purchase returns (supplier_invoices with invoice_type = 'purchase_return') decrease stock.
   - Amount is driven by the item quantity; sign follows the document type above.
   - Items with a null product_id are skipped (free-text line items).
   - The trigger fires AFTER INSERT / UPDATE / DELETE on both item tables, so editing
     or deleting an invoice keeps stock correct automatically.

3. Security
   - No RLS changes; triggers run as the table owner and are not user-facing.

4. Notes
   - Stock changes are cumulative and always relative to the change in quantity, so
     editing an invoice (delete-then-reinsert pattern used by the app) nets out correctly.
*/

CREATE OR REPLACE FUNCTION adjust_stock_on_invoice_item()
RETURNS trigger AS $$
DECLARE
  v_delta numeric;
  v_doc_type text;
  v_table text;
BEGIN
  v_table := TG_TABLE_NAME;

  IF v_table = 'customer_invoice_items' THEN
    IF TG_OP = 'DELETE' THEN
      v_delta := OLD.quantity;
    ELSE
      v_delta := NEW.quantity;
    END IF;
    SELECT invoice_type INTO v_doc_type FROM customer_invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    IF v_doc_type = 'sale' THEN
      v_delta := -v_delta;
    ELSIF v_doc_type = 'sales_return' THEN
      v_delta := v_delta; -- stock comes back
    ELSE
      RETURN NULL; -- other types: no stock effect
    END IF;
  ELSIF v_table = 'supplier_invoice_items' THEN
    IF TG_OP = 'DELETE' THEN
      v_delta := OLD.quantity;
    ELSE
      v_delta := NEW.quantity;
    END IF;
    SELECT invoice_type INTO v_doc_type FROM supplier_invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    IF v_doc_type = 'purchase' THEN
      v_delta := v_delta;
    ELSIF v_doc_type = 'purchase_return' THEN
      v_delta := -v_delta;
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  IF COALESCE(NEW.product_id, OLD.product_id) IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE products
  SET stock_quantity = stock_quantity + v_delta
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_customer_invoice_items ON customer_invoice_items;
CREATE TRIGGER trg_stock_customer_invoice_items
AFTER INSERT OR UPDATE OR DELETE ON customer_invoice_items
FOR EACH ROW EXECUTE FUNCTION adjust_stock_on_invoice_item();

DROP TRIGGER IF EXISTS trg_stock_supplier_invoice_items ON supplier_invoice_items;
CREATE TRIGGER trg_stock_supplier_invoice_items
AFTER INSERT OR UPDATE OR DELETE ON supplier_invoice_items
FOR EACH ROW EXECUTE FUNCTION adjust_stock_on_invoice_item();