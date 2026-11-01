#!/usr/bin/env python3
"""Golden dataset generator for DistribPro SQLite migration.

Builds migration/golden/golden-backup.json in the OLD app's backup format
(src/lib/backup.ts: {meta, data:{table: rows}}) plus expected-totals.json.
Every number is asserted while generating, so the expected totals cannot
drift from the dataset. Stock finals follow the CORRECT stock logic
(DECISIONS.md D6), not the buggy trigger.
"""
import json
from pathlib import Path

OUT = Path(__file__).parent

def uid(prefix, n):
    return f"{prefix:08x}-0000-4000-8000-{n:012d}"

SET_ID = uid(0x5E77, 1)
C1, C2, C3 = uid(0xC001, 1), uid(0xC001, 2), uid(0xC001, 3)
S1, S2 = uid(0x5001, 1), uid(0x5001, 2)
P1, P2, P3, P4 = uid(0x9001, 1), uid(0x9001, 2), uid(0x9001, 3), uid(0x9001, 4)
R1, R2 = uid(0x8001, 1), uid(0x8001, 2)
E1, E2 = uid(0xE001, 1), uid(0xE001, 2)
CI1, CI2, CI3 = uid(0xC1A0, 1), uid(0xC1A0, 2), uid(0xC1A0, 3)   # customer invoices
SI1, SI2 = uid(0x51A0, 1), uid(0x51A0, 2)                        # supplier invoices
ADMIN_ID = uid(0xAD01, 1)
D = "2026-10-05T09:00:00.000Z"

data = {
    "settings": [{
        "id": SET_ID, "company_name": "Golden Test Distribution",
        "company_address": "Main Bazaar Road", "company_phone": "0300-0000000",
        "company_email": None, "currency_symbol": "Rs", "tax_rate": 0,
        "invoice_prefix": "INV-", "supplier_invoice_prefix": "SUP-",
        "payment_voucher_prefix": "PV-", "expense_voucher_prefix": "EV-",
        "gate_pass_prefix": "GP-", "sales_return_prefix": "SR-",
        "purchase_return_prefix": "PR-", "default_print_format": "a4",
        "thermal_printer_width": "80mm",
        "invoice_footer_note": "Thank you for your business!", "created_at": D,
    }],
    "employees": [
        {"id": E1, "name": "Muhammad Saleem", "phone": "0301-1111111", "address": None,
         "position": "Salesman", "salary": 35000, "hire_date": "2026-01-01",
         "is_active": True, "created_at": D},
        {"id": E2, "name": "Ali Raza", "phone": "0302-2222222", "address": None,
         "position": "Helper", "salary": 28000, "hire_date": "2026-02-01",
         "is_active": True, "created_at": D},
    ],
    "routes": [
        {"id": R1, "name": "Monday Route", "description": "City side", "day_of_week": 1,
         "sort_order": 1, "created_at": D},
        {"id": R2, "name": "Wednesday Route", "description": "Town side", "day_of_week": 3,
         "sort_order": 2, "created_at": D},
    ],
    "customers": [
        {"id": C1, "name": "Ahmed Traders", "phone": "0321-1111111", "address": "Shop 1",
         "city": "Lahore", "opening_balance": 0, "current_balance": 0,
         "balance_type": "receivable", "created_at": D},
        {"id": C2, "name": "Bilal Store", "phone": "0322-2222222", "address": "Shop 2",
         "city": "Karachi", "opening_balance": 0, "current_balance": 2000,
         "balance_type": "receivable", "created_at": D},
        {"id": C3, "name": "City Mart", "phone": "0323-3333333", "address": "Shop 3",
         "city": "Multan", "opening_balance": 5000, "current_balance": 5000,
         "balance_type": "receivable", "created_at": D},
    ],
    "suppliers": [
        {"id": S1, "name": "Punjab Foods", "phone": "0331-1111111", "address": "Warehouse 1",
         "city": "Lahore", "opening_balance": 0, "current_balance": 20000,
         "balance_type": "payable", "created_at": D},
        {"id": S2, "name": "Sindh Packaging", "phone": "0332-2222222", "address": "Warehouse 2",
         "city": "Karachi", "opening_balance": 0, "current_balance": 0,
         "balance_type": "payable", "created_at": D},
    ],
    # Final stock = opening stock pushed through the dataset's transactions
    # with CORRECT logic (D6): opening P1 100, P2 50, P3 20, P4 5.
    "products": [
        {"id": P1, "name": "Cooking Oil 1L", "sku": "OIL-1L", "category": "Grocery",
         "unit": "pcs", "purchase_price": 400, "sale_price": 500,
         "stock_quantity": 142, "reorder_level": 10, "created_at": D},
        {"id": P2, "name": "Rice 5kg", "sku": "RICE-5", "category": "Grocery",
         "unit": "bag", "purchase_price": 150, "sale_price": 200,
         "stock_quantity": 45, "reorder_level": 5, "created_at": D},
        {"id": P3, "name": "Desi Ghee 1kg", "sku": "GHEE-1", "category": "Grocery",
         "unit": "pcs", "purchase_price": 1000, "sale_price": 1500,
         "stock_quantity": 18, "reorder_level": 3, "created_at": D},
        {"id": P4, "name": "Sugar 1kg", "sku": "SUG-1", "category": "Grocery",
         "unit": "pcs", "purchase_price": 250, "sale_price": 350,
         "stock_quantity": 40, "reorder_level": 10, "created_at": D},
    ],
    "customer_routes": [
        {"id": uid(0xC801, 1), "customer_id": C1, "route_id": R1, "created_at": D},
        {"id": uid(0xC801, 2), "customer_id": C2, "route_id": R1, "created_at": D},
        {"id": uid(0xC801, 3), "customer_id": C3, "route_id": R2, "created_at": D},
    ],
    "customer_invoices": [
        {"id": CI1, "invoice_no": "INV-0001", "customer_id": C1, "invoice_date": "2026-10-05",
         "due_date": None, "subtotal": 6000, "discount": 0, "tax": 0, "total": 6000,
         "paid_amount": 6000, "balance": 0, "status": "paid", "invoice_type": "sale",
         "payment_type": "cash", "notes": None, "created_at": D},
        {"id": CI2, "invoice_no": "INV-0002", "customer_id": C2, "invoice_date": "2026-10-06",
         "due_date": None, "subtotal": 3000, "discount": 0, "tax": 0, "total": 3000,
         "paid_amount": 1000, "balance": 2000, "status": "unpaid", "invoice_type": "sale",
         "payment_type": "credit", "notes": None, "created_at": D},
        {"id": CI3, "invoice_no": "SR-0001", "customer_id": C1, "invoice_date": "2026-10-07",
         "due_date": None, "subtotal": 1000, "discount": 0, "tax": 0, "total": 1000,
         "paid_amount": 1000, "balance": 0, "status": "paid", "invoice_type": "sales_return",
         "payment_type": "cash", "notes": None, "created_at": D},
    ],
    "customer_invoice_items": [
        {"id": uid(0xC1B0, 1), "invoice_id": CI1, "product_id": P1, "product_name": "Cooking Oil 1L",
         "quantity": 10, "unit_price": 500, "discount_percent": 0, "total": 5000, "created_at": D},
        {"id": uid(0xC1B0, 2), "invoice_id": CI1, "product_id": P2, "product_name": "Rice 5kg",
         "quantity": 5, "unit_price": 200, "discount_percent": 0, "total": 1000, "created_at": D},
        {"id": uid(0xC1B0, 3), "invoice_id": CI2, "product_id": P3, "product_name": "Desi Ghee 1kg",
         "quantity": 2, "unit_price": 1500, "discount_percent": 0, "total": 3000, "created_at": D},
        {"id": uid(0xC1B0, 4), "invoice_id": CI3, "product_id": P1, "product_name": "Cooking Oil 1L",
         "quantity": 2, "unit_price": 500, "discount_percent": 0, "total": 1000, "created_at": D},
    ],
    "supplier_invoices": [
        {"id": SI1, "invoice_no": "SUP-0001", "supplier_id": S1, "invoice_date": "2026-10-03",
         "due_date": None, "subtotal": 30000, "discount": 0, "tax": 0, "total": 30000,
         "paid_amount": 10000, "balance": 20000, "status": "unpaid", "invoice_type": "purchase",
         "notes": None, "created_at": D},
        {"id": SI2, "invoice_no": "PR-0001", "supplier_id": S1, "invoice_date": "2026-10-08",
         "due_date": None, "subtotal": 1250, "discount": 0, "tax": 0, "total": 1250,
         "paid_amount": 1250, "balance": 0, "status": "paid", "invoice_type": "purchase_return",
         "notes": None, "created_at": D},
    ],
    "supplier_invoice_items": [
        {"id": uid(0x51B0, 1), "invoice_id": SI1, "product_id": P1, "product_name": "Cooking Oil 1L",
         "quantity": 50, "unit_price": 400, "discount_percent": 0, "total": 20000, "created_at": D},
        {"id": uid(0x51B0, 2), "invoice_id": SI1, "product_id": P4, "product_name": "Sugar 1kg",
         "quantity": 40, "unit_price": 250, "discount_percent": 0, "total": 10000, "created_at": D},
        {"id": uid(0x51B0, 3), "invoice_id": SI2, "product_id": P4, "product_name": "Sugar 1kg",
         "quantity": 5, "unit_price": 250, "discount_percent": 0, "total": 1250, "created_at": D},
    ],
    "payment_vouchers": [
        {"id": uid(0x9A70, 1), "voucher_no": "PV-0001", "customer_id": C2, "supplier_id": None,
         "voucher_date": "2026-10-06", "amount": 1000, "payment_method": "cash",
         "reference": "INV-0002", "notes": None, "created_at": D},
        {"id": uid(0x9A70, 2), "voucher_no": "PV-0002", "customer_id": None, "supplier_id": S1,
         "voucher_date": "2026-10-04", "amount": 10000, "payment_method": "bank",
         "reference": "SUP-0001", "notes": None, "created_at": D},
    ],
    "expense_vouchers": [
        {"id": uid(0xE570, 1), "voucher_no": "EV-0001", "expense_date": "2026-10-01",
         "category": "Rent", "description": "Shop rent October", "amount": 5000,
         "paid_to": "Landlord", "created_at": D},
        {"id": uid(0xE570, 2), "voucher_no": "EV-0002", "expense_date": "2026-10-09",
         "category": "Fuel", "description": "Delivery vehicle fuel", "amount": 1500,
         "paid_to": "Petrol pump", "created_at": D},
    ],
    "gate_passes": [
        {"id": uid(0x6A7E, 1), "pass_no": "GP-0001", "pass_type": "sales", "customer_id": C1,
         "customer_name": "Ahmed Traders", "pass_date": "2026-10-05",
         "reference_invoice": "INV-0001", "items_description": "Cooking Oil x10, Rice x5",
         "total_amount": 6000, "vehicle_no": "LEA-123", "driver_name": "Muhammad Saleem",
         "notes": None, "created_at": D},
    ],
    "salary_payments": [
        {"id": uid(0x5A10, 1), "employee_id": E1, "payment_date": "2026-10-31",
         "amount": 30000, "month": "2026-10", "payment_method": "cash",
         "notes": None, "created_at": D},
        {"id": uid(0x5A10, 2), "employee_id": E2, "payment_date": "2026-10-31",
         "amount": 28000, "month": "2026-10", "payment_method": "cash",
         "notes": None, "created_at": D},
    ],
    "income_options": [
        {"id": uid(0x1AC0, 1), "description": "Scrap sale", "amount": 2000,
         "income_date": "2026-10-10", "category": "Other", "reference": None, "created_at": D},
    ],
    "user_permissions": [
        {"user_id": ADMIN_ID, "permissions": ["dashboard", "customers", "invoices", "settings"],
         "updated_at": D},
    ],
    "salesman_targets": [
        {"id": uid(0x7A80, 1), "salesman_name": "Muhammad Saleem", "route_id": R1,
         "target_month": "2026-10", "target_amount": 100000, "created_at": D},
    ],
}

# ---- assertions: item totals, invoice totals, stock derivation --------------
for tbl in ("customer_invoice_items", "supplier_invoice_items"):
    for it in data[tbl]:
        assert it["total"] == round(it["quantity"] * it["unit_price"] * (1 - it["discount_percent"] / 100), 2), it
for inv_tbl, item_tbl in (("customer_invoices", "customer_invoice_items"),
                          ("supplier_invoices", "supplier_invoice_items")):
    for inv in data[inv_tbl]:
        s = sum(i["total"] for i in data[item_tbl] if i["invoice_id"] == inv["id"])
        assert inv["subtotal"] == s, (inv["invoice_no"], s)
        assert inv["total"] == inv["subtotal"] - inv["discount"] + inv["tax"], inv["invoice_no"]
        assert inv["balance"] == inv["total"] - inv["paid_amount"], inv["invoice_no"]
        assert inv["status"] == ("paid" if inv["balance"] <= 0 else "unpaid"), inv["invoice_no"]

opening = {P1: 100, P2: 50, P3: 20, P4: 5}
stock = dict(opening)
SIGN = {"sale": -1, "sales_return": +1, "purchase": +1, "purchase_return": -1}
for inv_tbl, item_tbl in (("customer_invoices", "customer_invoice_items"),
                          ("supplier_invoices", "supplier_invoice_items")):
    types = {i["id"]: i["invoice_type"] for i in data[inv_tbl]}
    for it in data[item_tbl]:
        stock[it["product_id"]] += SIGN[types[it["invoice_id"]]] * it["quantity"]
for p in data["products"]:
    assert p["stock_quantity"] == stock[p["id"]], (p["name"], p["stock_quantity"], stock[p["id"]])

def total(tbl, key="total", **flt):
    return sum(r[key] for r in data[tbl] if all(r.get(k) == v for k, v in flt.items()))

expected = {
    "note": "All money in rupees (old backup format). New DB stores integer paisa = rupees x 100; quantities x1000 in new DB.",
    "table_counts": {t: len(rows) for t, rows in data.items()},
    "sales_total": total("customer_invoices", invoice_type="sale"),
    "sales_returns_total": total("customer_invoices", invoice_type="sales_return"),
    "net_sales": total("customer_invoices", invoice_type="sale") - total("customer_invoices", invoice_type="sales_return"),
    "purchases_total": total("supplier_invoices", invoice_type="purchase"),
    "purchase_returns_total": total("supplier_invoices", invoice_type="purchase_return"),
    "net_purchases": total("supplier_invoices", invoice_type="purchase") - total("supplier_invoices", invoice_type="purchase_return"),
    "customer_invoice_outstanding": sum(i["balance"] for i in data["customer_invoices"]),
    "supplier_invoice_outstanding": sum(i["balance"] for i in data["supplier_invoices"]),
    "customers_current_balance_sum": total("customers", "current_balance"),
    "suppliers_current_balance_sum": total("suppliers", "current_balance"),
    "expenses_total": total("expense_vouchers", "amount"),
    "salaries_paid_total": total("salary_payments", "amount"),
    "other_income_total": total("income_options", "amount"),
    "payment_vouchers_total": total("payment_vouchers", "amount"),
    "stock_final": {p["name"]: p["stock_quantity"] for p in data["products"]},
    "stock_value_at_purchase": sum(p["stock_quantity"] * p["purchase_price"] for p in data["products"]),
    "stock_value_at_sale": sum(p["stock_quantity"] * p["sale_price"] for p in data["products"]),
}

backup = {
    "meta": {"app": "distribpro", "version": 1, "created_at": "2026-10-31T00:00:00.000Z",
             "tables": expected["table_counts"]},
    "data": data,
}
(OUT / "golden-backup.json").write_text(json.dumps(backup, indent=2))
(OUT / "expected-totals.json").write_text(json.dumps(expected, indent=2))
print("OK — golden dataset written")
print(json.dumps(expected, indent=2))
